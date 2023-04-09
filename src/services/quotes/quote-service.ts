import { AmountOfToken, ChainId, FieldsRequirements, SupportInChain, TimeString, TokenAddress } from '@types';
import {
  EstimatedQuoteResponse,
  EstimatedQuoteRequest,
  FailedQuote,
  IndividualQuoteRequest,
  IQuoteService,
  QuoteRequest,
  QuoteResponse,
  IgnoreFailedQuotes,
  SourceId,
  SourceMetadata,
} from './types';
import { CompareQuotesBy, CompareQuotesUsing, sortQuotesBy } from './quote-compare';
import { IQuoteSourceList, SourceListResponse } from './source-lists/types';
import { chainsUnion, getChainByKeyOrFail } from '@chains';
import { amountToUSD, calculateGasDetails, isSameAddress } from '@shared/utils';
import { IGasService, IMetadataService, IPriceService, TokenPrice } from '..';
import { BaseTokenMetadata } from '@services/metadata/types';
import { IQuickGasCostCalculator, DefaultGasValues } from '@services/gas/types';
import { Addresses } from '@shared/constants';
import { reduceTimeout } from '@shared/timeouts';
import { utils } from 'ethers';
import { TriggerablePromise } from '@shared/triggerable-promise';
import { couldSupportMeetRequirements } from '@shared/requirements-and-support';
import { SourceConfig, SourceWithConfigId } from './source-registry';
import {
  FailedToGenerateQuoteError,
  SourceNoBuyOrdersError,
  SourceNoSwapAndTransferError,
  SourceNotFoundError,
  SourceNotOnChainError,
} from './errors';

const REQUIREMENTS: FieldsRequirements<BaseTokenMetadata> = {
  requirements: { symbol: 'required', decimals: 'required' },
  default: 'can ignore',
};

type ConstructorParameters = {
  priceService: IPriceService;
  gasService: IGasService<DefaultGasValues>;
  metadataService: IMetadataService<BaseTokenMetadata>;
  sourceList: IQuoteSourceList;
  defaultConfig: SourceConfig | undefined;
};
export class QuoteService implements IQuoteService {
  private readonly priceService: IPriceService;
  private readonly gasService: IGasService<DefaultGasValues>;
  private readonly metadataService: IMetadataService<BaseTokenMetadata>;
  private readonly sourceList: IQuoteSourceList;
  private readonly defaultConfig: SourceConfig | undefined;

  constructor({ priceService, gasService, metadataService, sourceList, defaultConfig }: ConstructorParameters) {
    this.priceService = priceService;
    this.gasService = gasService;
    this.metadataService = metadataService;
    this.sourceList = sourceList;
    this.defaultConfig = defaultConfig;
  }

  supportedSources() {
    const filterOutUnsupportedChains = this.metadataChainFilter();
    const entries: [SourceId, SourceMetadata][] = Object.entries(this.sourceList.supportedSources()).map(([sourceId, metadata]) => [
      sourceId,
      filterOutUnsupportedChains(metadata),
    ]);
    return Object.fromEntries(entries);
  }

  supportedChains() {
    const allChains = Object.values(this.supportedSources()).map(({ supports: { chains } }) => chains);
    return chainsUnion(allChains);
  }

  supportedSourcesInChain({ chainId }: { chainId: ChainId }) {
    const sourcesInChain = Object.entries(this.supportedSources()).filter(([, source]) => source.supports.chains.includes(chainId));
    return Object.fromEntries(sourcesInChain);
  }

  supportedGasSpeeds(): Record<ChainId, SupportInChain<DefaultGasValues>> {
    return this.gasService.supportedSpeeds();
  }

  async getQuote({
    sourceId,
    request,
    config,
  }: {
    sourceId: SourceId;
    request: IndividualQuoteRequest;
    config?: { timeout?: TimeString };
  }): Promise<QuoteResponse> {
    const sources = this.supportedSources();
    if (!(sourceId in sources)) {
      throw new SourceNotFoundError(sourceId);
    }

    const sourceSupport = sources[sourceId].supports;
    const supportedChains = sourceSupport.chains.map((chainId) => chainId);
    if (!supportedChains.includes(request.chainId)) {
      throw new SourceNotOnChainError(sourceId, request.chainId);
    }
    const shouldFailBecauseTransferNotSupported =
      !sourceSupport.swapAndTransfer &&
      !!request.recipient &&
      !isSameAddress(request.takerAddress, request.recipient) &&
      !request.dontFailIfSourceDoesNotSupportTransferAndRecipientIsSet;
    if (shouldFailBecauseTransferNotSupported) {
      throw new SourceNoSwapAndTransferError(sourceId);
    }

    const shouldFailBecauseBuyOrderNotSupported =
      !sourceSupport.buyOrders && request.order.type === 'buy' && !request.estimateBuyOrderIfSourceDoesNotSupportIt;

    if (shouldFailBecauseBuyOrderNotSupported) {
      throw new SourceNoBuyOrdersError(sourceId);
    }

    const quotes = this.getQuotes({
      request: {
        ...request,
        includeNonTransferSourcesWhenRecipientIsSet: true,
        estimateBuyOrdersWithSellOnlySources: true,
        filters: { includeSources: [sourceId] },
        sourceConfig: {
          global: request.sourceConfig?.global,
          custom: request.sourceConfig?.custom && { [sourceId]: request.sourceConfig.custom },
        },
      },
      config,
    });

    if (quotes.length !== 1) {
      throw new Error('This is weird, not sure what happened');
    }

    const quote = await quotes[0];

    if ('failed' in quote) {
      throw new FailedToGenerateQuoteError(quote.name, request.chainId, request.sellToken, request.buyToken, quote.error);
    }

    return quote;
  }

  estimateQuotes({ request, config }: { request: EstimatedQuoteRequest; config?: { timeout?: TimeString } }) {
    const quotes = this.getQuotes({ request: estimatedToQuoteRequest(request), config });
    return quotes.map((promise) => promise.then((response) => ifNotFailed(response, quoteResponseToEstimated)));
  }

  async estimateAllQuotes<IgnoreFailed extends boolean = true>({
    request,
    config,
  }: {
    request: EstimatedQuoteRequest;
    config?: { ignoredFailed?: IgnoreFailed; sort?: { by: CompareQuotesBy; using?: CompareQuotesUsing }; timeout?: TimeString };
  }): Promise<IgnoreFailedQuotes<IgnoreFailed, EstimatedQuoteResponse>[]> {
    const allResponses = await this.getAllQuotes({ request: estimatedToQuoteRequest(request), config });
    return allResponses.map((response) => ifNotFailed(response, quoteResponseToEstimated)) as IgnoreFailedQuotes<
      IgnoreFailed,
      EstimatedQuoteResponse
    >[];
  }

  getQuotes({ request, config }: { request: QuoteRequest; config?: { timeout?: TimeString } }): Promise<QuoteResponse | FailedQuote>[] {
    const { promises, external } = this.calculateExternalPromises(request, config);
    const sources = this.calculateSources(request);
    return sources
      .map((sourceId) => ({
        sourceId,
        response: this.sourceList.getQuote({
          ...request,
          sourceId,
          sourceConfig: this.calculateConfig(sourceId, request.sourceConfig),
          external,
          quoteTimeout: config?.timeout,
        }),
      }))
      .map(({ sourceId, response }) => this.listResponseToQuoteResponse({ sourceId, request, response, promises }));
  }

  async getAllQuotes<IgnoreFailed extends boolean = true>({
    request,
    config,
  }: {
    request: QuoteRequest;
    config?: { ignoredFailed?: IgnoreFailed; sort?: { by: CompareQuotesBy; using?: CompareQuotesUsing }; timeout?: TimeString };
  }): Promise<IgnoreFailedQuotes<IgnoreFailed, QuoteResponse>[]> {
    const responses = await Promise.all(this.getQuotes({ request, config }));
    const successfulQuotes = responses.filter((response): response is QuoteResponse => !('failed' in response));
    const failedQuotes = config?.ignoredFailed === false ? responses.filter((response): response is FailedQuote => 'failed' in response) : [];

    const sortedQuotes = sortQuotesBy(
      successfulQuotes,
      config?.sort?.by ?? 'most-swapped-accounting-for-gas',
      config?.sort?.using ?? 'sell/buy amounts'
    );

    return [...sortedQuotes, ...failedQuotes] as IgnoreFailedQuotes<IgnoreFailed, QuoteResponse>[];
  }

  private async listResponseToQuoteResponse({
    sourceId,
    request,
    response: responsePromise,
    promises,
  }: {
    sourceId: SourceId;
    request: QuoteRequest;
    response: Promise<SourceListResponse>;
    promises: Promises;
  }): Promise<QuoteResponse | FailedQuote> {
    try {
      const [response, tokens, prices, gasCalculator] = await Promise.all([
        responsePromise,
        promises.tokens,
        promises.prices,
        promises.gasCalculator,
      ]);
      const sellToken = { ...tokens[request.sellToken], price: prices[request.sellToken] };
      const buyToken = { ...tokens[request.buyToken], price: prices[request.buyToken] };
      const gasCost = gasCalculator.calculateGasCost({
        gasEstimation: response.estimatedGas,
        tx: response.tx,
      });
      // TODO: We should add the gas price to the tx response, but if we do, we get some weird errors. Investigate and add it to to the tx
      const { gasCostNativeToken, ...gasPrice } = gasCost[request.gasSpeed?.speed ?? 'standard'] ?? gasCost['standard'];
      return {
        ...response,
        sellToken: { ...sellToken, address: request.sellToken },
        buyToken: { ...buyToken, address: request.buyToken },
        sellAmount: toAmountOfToken(sellToken, sellToken.price, response.sellAmount),
        buyAmount: toAmountOfToken(buyToken, buyToken.price, response.buyAmount),
        maxSellAmount: toAmountOfToken(sellToken, sellToken.price, response.maxSellAmount),
        minBuyAmount: toAmountOfToken(buyToken, buyToken.price, response.minBuyAmount),
        gas: {
          estimatedGas: response.estimatedGas,
          ...calculateGasDetails(getChainByKeyOrFail(request.chainId), gasCostNativeToken, prices[Addresses.NATIVE_TOKEN]),
        },
      };
    } catch (e) {
      const metadata = this.supportedSources()[sourceId];
      return {
        failed: true,
        name: metadata.name,
        logoURI: metadata.logoURI,
        error: e instanceof Error ? e.message : JSON.stringify(e),
      };
    }
  }

  private calculateSources({
    filters,
    includeNonTransferSourcesWhenRecipientIsSet,
    estimateBuyOrdersWithSellOnlySources,
    ...request
  }: QuoteRequest): SourceId[] {
    const sourcesInChain = this.supportedSourcesInChain(request);
    let sourceIds = Object.keys(sourcesInChain);

    if (filters?.includeSources) {
      sourceIds = sourceIds.filter((id) => filters!.includeSources!.includes(id));
    } else if (filters?.excludeSources) {
      sourceIds = sourceIds.filter((id) => !filters!.excludeSources!.includes(id));
    }

    if (request.order.type === 'buy' && !estimateBuyOrdersWithSellOnlySources) {
      sourceIds = sourceIds.filter((sourceIds) => sourcesInChain[sourceIds].supports.buyOrders);
    }

    if (request.recipient && request.recipient !== request.takerAddress && !includeNonTransferSourcesWhenRecipientIsSet) {
      sourceIds = sourceIds.filter((sourceIds) => sourcesInChain[sourceIds].supports.swapAndTransfer);
    }

    return sourceIds;
  }

  private calculateExternalPromises(request: QuoteRequest, config: { timeout?: TimeString } | undefined) {
    const reducedTimeout = reduceTimeout(config?.timeout, '200');
    const selectedGasSpeed = request.gasSpeed?.speed ?? 'standard';
    const tokens = this.metadataService
      .getMetadataForChain({
        chainId: request.chainId,
        addresses: [request.sellToken, request.buyToken],
        config: {
          timeout: reducedTimeout,
          fields: REQUIREMENTS,
        },
      })
      .catch(() => Promise.reject(new Error(`Failed to fetch the quote's tokens`)));
    const prices = this.priceService
      .getCurrentPricesForChain({
        chainId: request.chainId,
        addresses: [request.sellToken, request.buyToken, Addresses.NATIVE_TOKEN],
        config: { timeout: reducedTimeout },
      })
      .catch(() => ({ [request.sellToken]: 0, [request.buyToken]: 0, [Addresses.NATIVE_TOKEN]: 0 }));
    const gasCalculator = this.gasService
      .getQuickGasCalculator({
        chainId: request.chainId,
        config: {
          timeout: reducedTimeout,
          fields: {
            requirements: {
              [selectedGasSpeed]: request.gasSpeed?.requirement ?? 'best effort',
              standard: 'required',
            },
            default: 'can ignore',
          },
        },
      })
      .catch(() => Promise.reject(new Error(`Failed to fetch gas data`)));

    return {
      promises: { tokens, prices, gasCalculator },
      external: {
        tokenData: new TriggerablePromise(() =>
          tokens.then((tokens) => ({ sellToken: tokens[request.sellToken], buyToken: tokens[request.buyToken] }))
        ),
        gasPrice: new TriggerablePromise(() =>
          gasCalculator.then((calculator) => {
            const gasPrice = calculator.getGasPrice();
            return gasPrice[selectedGasSpeed] ?? gasPrice['standard']!;
          })
        ),
      },
    };
  }

  // There are some properties that are necessary for the quote service to work, so we'll filter out chains where
  // those properties are not available
  private metadataChainFilter(): (metadata: SourceMetadata) => SourceMetadata {
    const tokenProperties = this.metadataService.supportedProperties();
    return (metadata: SourceMetadata) => ({
      ...metadata,
      supports: {
        ...metadata.supports,
        chains: metadata.supports.chains.filter((chainId) => couldSupportMeetRequirements(tokenProperties[chainId], REQUIREMENTS)),
      },
    });
  }

  private calculateConfig(sourceId: string, sourceConfigs: SourceConfig | undefined) {
    const id = sourceId as SourceWithConfigId;
    return {
      ...this.defaultConfig?.global,
      ...this.defaultConfig?.custom?.[id],
      ...sourceConfigs?.global,
      ...sourceConfigs?.custom?.[id],
    };
  }
}

function ifNotFailed<T1 extends object, T2 extends object>(response: T1 | FailedQuote, mapped: (_: T1) => T2): T2 | FailedQuote {
  return 'failed' in response ? response : mapped(response);
}

function toAmountOfToken(token: BaseTokenMetadata, price: TokenPrice | undefined, amount: AmountOfToken) {
  const amountInUSD = amountToUSD(token.decimals, amount, price);
  return {
    amount: amount.toString(),
    amountInUnits: utils.formatUnits(amount, token.decimals),
    amountInUSD,
  };
}

function estimatedToQuoteRequest(request: EstimatedQuoteRequest): QuoteRequest {
  return {
    ...request,
    takerAddress: '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045', // We set a random taker address so that txs can be built at the source level
  };
}

function quoteResponseToEstimated({ recipient, tx, ...response }: QuoteResponse): EstimatedQuoteResponse {
  return response;
}

type Promises = {
  tokens: Promise<Record<TokenAddress, BaseTokenMetadata>>;
  prices: Promise<Record<TokenAddress, TokenPrice>>;
  gasCalculator: Promise<IQuickGasCostCalculator<DefaultGasValues>>;
};
