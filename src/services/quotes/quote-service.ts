import { BigIntish, ChainId, FieldsRequirements, SupportInChain, TimeString, TokenAddress } from '@types';
import {
  FailedResponse,
  IQuoteService,
  QuoteRequest,
  QuoteResponse,
  IgnoreFailedResponses,
  SourceId,
  SourceMetadata,
  QuoteTransaction,
  EstimatedQuoteRequest,
  EstimatedQuoteResponse,
} from './types';
import { CompareQuotesBy, CompareQuotesUsing, sortQuotesBy } from './quote-compare';
import { IQuoteSourceList, SourceListQuoteResponse } from './source-lists/types';
import { chainsUnion, getChainByKeyOrFail } from '@chains';
import { amountToUSD, toAmountsOfToken } from '@shared/utils';
import { IGasService, IMetadataService, IPriceService, PriceResult } from '..';
import { BaseTokenMetadata } from '@services/metadata/types';
import { IQuickGasCostCalculator, DefaultGasValues } from '@services/gas/types';
import { Addresses } from '@shared/constants';
import { reduceTimeout } from '@shared/timeouts';
import { formatUnits } from 'viem';
import { TriggerablePromise } from '@shared/triggerable-promise';
import { couldSupportMeetRequirements } from '@shared/requirements-and-support';
import { SourceConfig } from './source-registry';
import { FailedToGenerateAnyQuotesError } from './errors';
import merge from 'deepmerge';

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

  estimateQuotes({ request, config }: { request: EstimatedQuoteRequest; config?: { timeout?: TimeString } }) {
    const quotes = this.getQuotes({ request: estimatedToQuoteRequest(request), config });
    const entries = Object.entries(quotes).map(([sourceId, quote]) => [sourceId, quote.then(quoteResponseToEstimated)]);
    return Object.fromEntries(entries);
  }

  async estimateAllQuotes<IgnoreFailed extends boolean = true>({
    request,
    config,
  }: {
    request: EstimatedQuoteRequest;
    config?: { ignoredFailed?: IgnoreFailed; sort?: { by: CompareQuotesBy; using?: CompareQuotesUsing }; timeout?: TimeString };
  }): Promise<IgnoreFailedResponses<IgnoreFailed, EstimatedQuoteResponse>[]> {
    const allResponses = await this.getAllQuotes({ request: estimatedToQuoteRequest(request), config });
    return allResponses.map((response) => ifNotFailed(response, quoteResponseToEstimated)) as IgnoreFailedResponses<
      IgnoreFailed,
      EstimatedQuoteResponse
    >[];
  }

  getQuotes({ request, config }: { request: QuoteRequest; config?: { timeout?: TimeString } }): Record<SourceId, Promise<QuoteResponse>> {
    const { promises, external } = this.calculateExternalPromises(request, config);
    const sources = this.calculateSources(request);
    const responses = this.sourceList.getQuotes({
      ...request,
      sources,
      external,
      quoteTimeout: config?.timeout,
      sourceConfig: this.calculateConfig(request.sourceConfig),
    });
    const entries = Object.entries(responses).map(([sourceId, response]) => [
      sourceId,
      this.listResponseToQuoteResponse({ request, response, promises }),
    ]);

    return Object.fromEntries(entries);
  }

  async getAllQuotes<IgnoreFailed extends boolean = true>({
    request,
    config,
  }: {
    request: QuoteRequest;
    config?: { ignoredFailed?: IgnoreFailed; sort?: { by: CompareQuotesBy; using?: CompareQuotesUsing }; timeout?: TimeString };
  }): Promise<IgnoreFailedResponses<IgnoreFailed, QuoteResponse>[]> {
    const metadata = this.supportedSources();
    const quotes = Object.entries(this.getQuotes({ request, config })).map(([sourceId, response]) =>
      handleResponseFailure(sourceId, response, metadata)
    );

    const responses = await Promise.all(quotes);
    const successfulQuotes = responses.filter((response): response is QuoteResponse => !('failed' in response));
    const failedQuotes = config?.ignoredFailed === false ? responses.filter((response): response is FailedResponse => 'failed' in response) : [];

    const sortedQuotes = sortQuotesBy(successfulQuotes, config?.sort?.by ?? 'most-swapped', config?.sort?.using ?? 'sell/buy amounts');

    return [...sortedQuotes, ...failedQuotes] as IgnoreFailedResponses<IgnoreFailed, QuoteResponse>[];
  }

  async getBestQuote({
    request,
    config,
  }: {
    request: QuoteRequest;
    config?: { choose?: { by: CompareQuotesBy; using?: CompareQuotesUsing }; timeout?: TimeString };
  }): Promise<QuoteResponse> {
    const allQuotes = await this.getAllQuotes({
      request,
      config: {
        timeout: config?.timeout,
        sort: config?.choose,
        ignoredFailed: true,
      },
    });
    if (allQuotes.length === 0) {
      throw new FailedToGenerateAnyQuotesError(request.chainId, request.sellToken, request.buyToken);
    }
    return allQuotes[0];
  }

  buildTxs({
    quotes,
    config,
    sourceConfig,
  }: {
    quotes: Record<SourceId, Promise<QuoteResponse>> | Record<SourceId, QuoteResponse>;
    sourceConfig?: SourceConfig;
    config?: { timeout?: TimeString };
  }): Record<SourceId, Promise<QuoteTransaction>> {
    const entries = Object.entries<Promise<QuoteResponse> | QuoteResponse>(quotes).map<[SourceId, Promise<QuoteResponse>]>(
      ([sourceId, response]) => (response instanceof Promise ? [sourceId, response] : [sourceId, Promise.resolve(response)])
    );
    const input: Record<SourceId, Promise<QuoteResponse>> = Object.fromEntries(entries);
    return this.sourceList.buildTxs({
      quotes: input,
      quoteTimeout: config?.timeout,
      sourceConfig: this.calculateConfig(sourceConfig),
    });
  }

  async buildAllTxs<IgnoreFailed extends boolean = true>({
    quotes,
    sourceConfig,
    config,
  }: {
    quotes: Record<SourceId, Promise<QuoteResponse>> | Promise<Record<SourceId, QuoteResponse>> | Record<SourceId, QuoteResponse>;
    sourceConfig?: SourceConfig;
    config?: {
      timeout?: TimeString;
      ignoredFailed?: IgnoreFailed;
    };
  }): Promise<Record<SourceId, IgnoreFailedResponses<IgnoreFailed, QuoteTransaction>>> {
    const txs = this.buildTxs({ quotes: await quotes, sourceConfig, config });
    const metadata = this.supportedSources();
    const entries = await Promise.all(
      Object.entries(txs).map<Promise<[SourceId, QuoteTransaction | FailedResponse]>>(async ([sourceId, tx]) => [
        sourceId,
        await handleResponseFailure(sourceId, tx, metadata),
      ])
    );
    const result = Object.fromEntries(entries) as Record<SourceId, IgnoreFailedResponses<IgnoreFailed, QuoteTransaction>>;
    if (config?.ignoredFailed !== false) {
      for (const sourceId in result) {
        if ('failed' in result[sourceId]) {
          delete result[sourceId];
        }
      }
    }
    return result;
  }

  private async listResponseToQuoteResponse({
    request,
    response: responsePromise,
    promises,
  }: {
    request: QuoteRequest;
    response: Promise<SourceListQuoteResponse>;
    promises: Promises;
  }): Promise<QuoteResponse> {
    const [response, tokens, prices, gasCalculator] = await Promise.all([
      responsePromise,
      promises.tokens,
      promises.prices,
      promises.gasCalculator,
    ]);
    if (!tokens) throw new Error(`Failed to fetch the quote's tokens`);
    if (!gasCalculator) throw new Error(`Failed to fetch gas data`);
    const sellToken = { ...tokens[request.sellToken], price: prices?.[request.sellToken]?.price };
    const buyToken = { ...tokens[request.buyToken], price: prices?.[request.buyToken]?.price };
    let gas: QuoteResponse['gas'];
    if (response.estimatedGas) {
      // Note: some sources provide a tx as part of the custom data, so we'll pass it just in case
      const gasCost = gasCalculator.calculateGasCost({ gasEstimation: response.estimatedGas, tx: response.customData.tx });
      const { gasCostNativeToken } = gasCost[request.gasSpeed?.speed ?? 'standard'] ?? gasCost['standard'];
      gas = {
        estimatedGas: response.estimatedGas,
        ...calculateGasDetails(
          getChainByKeyOrFail(request.chainId).nativeCurrency.symbol,
          gasCostNativeToken,
          prices?.[Addresses.NATIVE_TOKEN]?.price
        ),
      };
    }
    return {
      chainId: request.chainId,
      sellToken: { ...sellToken, address: request.sellToken },
      buyToken: { ...buyToken, address: request.buyToken },
      sellAmount: toAmountsOfToken({ ...sellToken, amount: response.sellAmount }),
      buyAmount: toAmountsOfToken({ ...buyToken, amount: response.buyAmount }),
      maxSellAmount: toAmountsOfToken({ ...sellToken, amount: response.maxSellAmount }),
      minBuyAmount: toAmountsOfToken({ ...buyToken, amount: response.minBuyAmount }),
      gas,
      accounts: { takerAddress: request.takerAddress, recipient: response.recipient },
      source: response.source,
      type: response.type,
      customData: response.customData,
    };
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
      .getMetadataInChain({
        chainId: request.chainId,
        tokens: [request.sellToken, request.buyToken],
        config: {
          timeout: reducedTimeout,
          fields: REQUIREMENTS,
        },
      })
      .catch(() => undefined);
    const prices = this.priceService
      .getCurrentPricesInChain({
        chainId: request.chainId,
        tokens: [request.sellToken, request.buyToken, Addresses.NATIVE_TOKEN],
        config: { timeout: reducedTimeout },
      })
      .catch(() => undefined);
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
      .catch(() => undefined);

    return {
      promises: { tokens, prices, gasCalculator },
      external: {
        tokenData: new TriggerablePromise(() =>
          tokens.then((tokens) => {
            return tokens
              ? { sellToken: tokens[request.sellToken], buyToken: tokens[request.buyToken] }
              : Promise.reject(new Error(`Failed to fetch the quote's tokens`));
          })
        ),
        gasPrice: new TriggerablePromise(() =>
          gasCalculator.then((calculator) => {
            if (!calculator) return Promise.reject(new Error(`Failed to fetch gas data`));
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

  private calculateConfig(sourceConfigs: SourceConfig | undefined): SourceConfig {
    return {
      global: merge(this.defaultConfig?.global ?? {}, sourceConfigs?.global ?? {}),
      custom: merge(this.defaultConfig?.custom ?? {}, sourceConfigs?.custom ?? {}),
    };
  }
}

export function ifNotFailed<T1 extends FailedResponse | object, T2>(
  response: T1 | FailedResponse,
  mapped: (_: T1) => T2
): T1 extends FailedResponse ? FailedResponse : T2 {
  return ('failed' in response ? response : mapped(response)) as T1 extends FailedResponse ? FailedResponse : T2;
}

function estimatedToQuoteRequest(request: EstimatedQuoteRequest): QuoteRequest {
  return {
    ...request,
    sourceConfig: {
      ...request.sourceConfig,
      global: {
        ...request.sourceConfig?.global,
        disableValidation: true,
      },
    },
    takerAddress: '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045', // We set a random taker address so that txs can be built at the source level
  };
}

function quoteResponseToEstimated({ customData, accounts, ...response }: QuoteResponse): EstimatedQuoteResponse {
  return response;
}

export function calculateGasDetails(gasTokenSymbol: string, gasCostNativeToken: BigIntish, nativeTokenPrice?: number) {
  return {
    estimatedCost: BigInt(gasCostNativeToken),
    estimatedCostInUnits: formatUnits(BigInt(gasCostNativeToken), 18),
    estimatedCostInUSD: amountToUSD(18, gasCostNativeToken, nativeTokenPrice),
    gasTokenPrice: nativeTokenPrice,
    gasTokenSymbol,
  };
}

export function handleResponseFailure<Response>(sourceId: SourceId, response: Promise<Response>, sources: Record<SourceId, SourceMetadata>) {
  return response.catch<FailedResponse>((e) => {
    const metadata = sources[sourceId];
    return {
      failed: true,
      source: {
        id: sourceId,
        name: metadata.name,
        logoURI: metadata.logoURI,
      },
      error: e instanceof Error ? e.message : JSON.stringify(e),
    };
  });
}

type Promises = {
  tokens: Promise<Record<TokenAddress, BaseTokenMetadata> | undefined>;
  prices: Promise<Record<TokenAddress, PriceResult> | undefined>;
  gasCalculator: Promise<IQuickGasCostCalculator<DefaultGasValues> | undefined>;
};
