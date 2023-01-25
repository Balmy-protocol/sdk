import { chainsUnion, Chains } from '@chains';
import { IFetchService } from '@services/fetch/types';
import { GasPrice, IGasService, IQuickGasCostCalculator } from '@services/gas/types';
import { ChainId } from '@types';
import { BigNumber, utils } from 'ethers';
import { BuyOrder, QuoteSource, QuoteSourceSupport, SellOrder, SourceQuoteRequest, SourceQuoteResponse } from './quote-sources/base';
import { AllSourcesConfig, buildSources } from './sources-list';
import {
  EstimatedQuoteResponse,
  EstimatedQuoteRequest,
  FailedQuote,
  GlobalQuoteSourceConfig,
  IndividualQuoteRequest,
  IQuoteService,
  QuoteRequest,
  QuoteResponse,
  TokenWithOptionalPrice,
  WithFailedQuotes,
  QuoteTx,
  AvailableSources,
} from './types';
import { BaseToken, ITokenService } from '@services/tokens/types';
import { Addresses } from '@shared/constants';
import { forcedTimeoutWrapper } from './quote-sources/wrappers/forced-timeout-wrapper';
import { buyToSellOrderWrapper } from './quote-sources/wrappers/buy-to-sell-order-wrapper';
import { amountToUSD, calculateGasDetails, filterRejectedResults, isSameAddress } from '@shared/utils';
import { CompareQuotesBy, CompareQuotesUsing, sortQuotesBy } from './quote-compare';

type ConstructorParameters = {
  fetchService: IFetchService;
  gasService: IGasService;
  tokenService: ITokenService<TokenWithOptionalPrice>;
  config?: GlobalQuoteSourceConfig & Partial<AllSourcesConfig>;
};
export class QuoteService implements IQuoteService {
  private readonly fetchService: IFetchService;
  private readonly gasService: IGasService;
  private readonly tokenService: ITokenService<TokenWithOptionalPrice>;
  private readonly sources: Record<AvailableSources, QuoteSource<QuoteSourceSupport, any>>;

  constructor({ fetchService, gasService, tokenService, config }: ConstructorParameters) {
    this.sources = addForcedTimeout(buildSources(config ?? {}, config));
    this.fetchService = fetchService;
    this.gasService = gasService;
    this.tokenService = tokenService;
  }

  supportedChains(): ChainId[] {
    const supportedChains = Object.values(this.sources).map((source) => source.getMetadata().supports.chains.map((chain) => chain.chainId));
    return chainsUnion(supportedChains);
  }

  supportedSources(): AvailableSources[] {
    return Object.keys(this.sources) as AvailableSources[];
  }

  supportedSourcesInChain(chainId: ChainId): AvailableSources[] {
    return Object.entries(this.sources)
      .filter(([, source]) => source.getMetadata().supports.chains.some((chain) => chain.chainId === chainId))
      .map(([sourceId]) => sourceId as AvailableSources);
  }

  getQuote(sourceId: AvailableSources, request: IndividualQuoteRequest): Promise<QuoteResponse> {
    const sourceSupport = this.sources[sourceId].getMetadata().supports;
    const supportedChains = sourceSupport.chains.map(({ chainId }) => chainId);
    if (!supportedChains.includes(request.chainId)) {
      throw new Error(`Source with '${sourceId}' does not support chain with id ${request.chainId}`);
    }
    const shouldFailBecauseTransferNotSupported =
      !sourceSupport.swapAndTransfer &&
      !!request.recipient &&
      !isSameAddress(request.takerAddress, request.recipient) &&
      !request.dontFailIfSourceDoesNotSupportTransferAndRecipientIsSet;
    if (shouldFailBecauseTransferNotSupported) {
      throw new Error(
        `Source with '${sourceId}' does not support swap & transfer, but a recipient different from the taker address was set. Maybe you want to use the 'dontFailIfSourceDoesNotSupportTransferAndRecipientIsSet' property?`
      );
    }

    const shouldFailBecauseBuyOrderNotSupported =
      !sourceSupport.buyOrders && request.order.type === 'buy' && !request.estimateBuyOrderIfSourceDoesNotSupportIt;

    if (shouldFailBecauseBuyOrderNotSupported) {
      throw new Error(
        `Source with '${sourceId}' does not support buy orders. Maybe you want to use the 'estimateBuyOrderIfSourceDoesNotSupportIt' property?`
      );
    }

    const quotes = this.getQuotes({
      ...request,
      includeNonTransferSourcesWhenRecipientIsSet: true,
      estimateBuyOrdersWithSellOnlySources: true,
      filters: { includeSources: [sourceId] },
    });

    if (quotes.length !== 1) {
      throw new Error('This is weird, not sure what happened');
    }

    return quotes[0];
  }

  estimateQuotes(estimatedRequest: EstimatedQuoteRequest): Promise<EstimatedQuoteResponse>[] {
    return this.getQuotes(estimatedToQuoteRequest(estimatedRequest)).map((response) => response.then(quoteResponseToEstimated));
  }

  async estimateAllQuotes<IgnoreFailed extends boolean = true>(
    estimatedRequest: EstimatedQuoteRequest,
    config?: { ignoredFailed?: IgnoreFailed; sort?: { by: CompareQuotesBy; using?: CompareQuotesUsing } }
  ): Promise<WithFailedQuotes<IgnoreFailed, EstimatedQuoteResponse>[]> {
    const allResponses = await this.getAllQuotes(estimatedToQuoteRequest(estimatedRequest), config);
    return allResponses.map((response) => ('failed' in response ? response : quoteResponseToEstimated(response)));
  }

  getQuotes(request: QuoteRequest): Promise<QuoteResponse>[] {
    return this.executeQuotes(request).map(({ response }) => response);
  }

  async getAllQuotes<IgnoreFailed extends boolean = true>(
    request: QuoteRequest,
    config?: { ignoredFailed?: IgnoreFailed; sort?: { by: CompareQuotesBy; using?: CompareQuotesUsing } }
  ): Promise<WithFailedQuotes<IgnoreFailed, QuoteResponse>[]> {
    let successfulQuotes: QuoteResponse[];
    let failedQuotes: FailedQuote[] = [];
    if (config?.ignoredFailed === false) {
      const promises = this.executeQuotes(request).map(({ source, response }) =>
        response.catch((e) => ({
          failed: true,
          name: source.getMetadata().name,
          logoURI: source.getMetadata().logoURI,
          error: e,
        }))
      );
      const responses = await Promise.all(promises);
      successfulQuotes = responses.filter((response): response is QuoteResponse => !('failed' in response));
      failedQuotes = responses.filter((response): response is FailedQuote => 'failed' in response);
    } else {
      successfulQuotes = await filterRejectedResults(this.getQuotes(request));
    }

    const sortedQuotes = sortQuotesBy(
      successfulQuotes,
      config?.sort?.by ?? 'most-swapped-accounting-for-gas',
      config?.sort?.using ?? 'sell/buy amounts'
    );

    return [...sortedQuotes, ...failedQuotes] as WithFailedQuotes<IgnoreFailed, QuoteResponse>[];
  }

  private executeQuotes(request: QuoteRequest) {
    // Ask for needed values, such as token data and gas price
    const tokensPromise = this.tokenService.getTokensForChain(request.chainId, [request.sellToken, request.buyToken, Addresses.NATIVE_TOKEN]);
    const sellTokenPromise = tokensPromise.then((tokens) => tokens[request.sellToken]);
    const buyTokenPromise = tokensPromise.then((tokens) => tokens[request.buyToken]);
    const gasPriceCalculatorPromise = this.gasService.getQuickGasCalculator(request.chainId);
    const gasPricePromise = gasPriceCalculatorPromise.then((calculator) => calculator.getGasPrice(request.gasSpeed));

    // Map request to source request
    const sourceRequest = mapRequestToSourceRequest({ request, sellTokenPromise, buyTokenPromise, gasPricePromise });

    // Ask for quotes
    const responses = this.getSourcesForRequest(request).map(({ sourceId, source }) => ({
      sourceId,
      source,
      response: source.quote({ fetchService: this.fetchService }, sourceRequest),
    }));

    // Group all value promises
    const values = Promise.all([
      sellTokenPromise,
      buyTokenPromise,
      gasPriceCalculatorPromise,
      tokensPromise.then((tokens) => tokens[Addresses.NATIVE_TOKEN]?.price).catch(() => undefined),
      gasPricePromise,
    ]).then(([sellToken, buyToken, gasCalculator, nativeTokenPrice]) => ({ sellToken, buyToken, gasCalculator, nativeTokenPrice }));

    // Map to response
    return responses.map(({ sourceId, source, response }) => ({
      source,
      response: mapSourceResponseToResponse({ sourceId, source, request, response, values }),
    }));
  }

  private getSourcesForRequest(request: QuoteRequest) {
    let sourceIds = this.supportedSourcesInChain(request.chainId);

    if (request.filters?.includeSources) {
      sourceIds = sourceIds.filter((id) => request.filters!.includeSources!.includes(id));
    } else if (request.filters?.excludeSources) {
      sourceIds = sourceIds.filter((id) => !request.filters!.excludeSources!.includes(id));
    }

    let sources = sourceIds.map((sourceId) => ({ sourceId, source: this.sources[sourceId] }));

    if (request.order.type === 'buy') {
      if (request.estimateBuyOrdersWithSellOnlySources) {
        sources = sources.map(({ sourceId, source }) => ({ sourceId, source: buyToSellOrderWrapper(source) }));
      } else {
        sources = sources.filter(({ source }) => source.getMetadata().supports.buyOrders);
      }
    }

    if (request.recipient && request.recipient !== request.takerAddress && !request.includeNonTransferSourcesWhenRecipientIsSet) {
      sources = sources.filter(({ source }) => source.getMetadata().supports.swapAndTransfer);
    }

    // Cast so that even if the source doesn't support it, everything else types ok
    return sources.map(({ sourceId, source }) => ({
      sourceId,
      source: source as QuoteSource<{ buyOrders: true; swapAndTransfer: boolean }, any>,
    }));
  }
}

function estimatedToQuoteRequest(request: EstimatedQuoteRequest): QuoteRequest {
  return {
    ...request,
    takerAddress: '0x4675c7e5baafbffbca748158becba61ef3b0a269', // We set a random taker address so that txs can be built at the source level
  };
}

function quoteResponseToEstimated({ recipient, tx, ...response }: QuoteResponse): EstimatedQuoteResponse {
  return response;
}

async function mapSourceResponseToResponse({
  sourceId,
  source,
  request,
  response: responsePromise,
  values,
}: {
  sourceId: AvailableSources;
  source: QuoteSource<QuoteSourceSupport, any>;
  request: QuoteRequest;
  response: Promise<SourceQuoteResponse>;
  values: Promise<{
    gasCalculator: IQuickGasCostCalculator;
    sellToken: TokenWithOptionalPrice;
    buyToken: TokenWithOptionalPrice;
    nativeTokenPrice: number | undefined;
  }>;
}): Promise<QuoteResponse> {
  const response = await responsePromise;
  const { sellToken, buyToken, gasCalculator, nativeTokenPrice } = await values;
  const txData = {
    to: response.tx.to,
    value: response.tx.value,
    data: response.tx.calldata,
    from: request.takerAddress,
  };
  const { gasCostNativeToken, ...gasPrice } = gasCalculator.calculateGasCost({
    gasEstimation: response.estimatedGas,
    speed: request.gasSpeed,
    tx: txData,
  });
  let tx: QuoteTx = txData;
  switch (request.chainId) {
    case Chains.OPTIMISM.chainId:
    case Chains.AURORA.chainId:
      // Do nothing, don't want to add the gas price here
      // For some reason, some wallets fail when you add the gas price in Optimism and Aurora
      break;
    default:
      tx = { ...tx, ...gasPrice };
  }
  const recipient = request.recipient && source.getMetadata().supports.swapAndTransfer ? request.recipient : request.takerAddress;
  return {
    sellToken,
    buyToken,
    sellAmount: toAmountOfToken(sellToken, sellToken?.price, response.sellAmount),
    buyAmount: toAmountOfToken(buyToken, buyToken?.price, response.buyAmount),
    maxSellAmount: toAmountOfToken(sellToken, sellToken?.price, response.maxSellAmount),
    minBuyAmount: toAmountOfToken(buyToken, buyToken?.price, response.minBuyAmount),
    gas: {
      estimatedGas: response.estimatedGas,
      ...calculateGasDetails(Chains.byKeyOrFail(request.chainId), gasCostNativeToken, nativeTokenPrice),
    },
    recipient,
    source: { id: sourceId, allowanceTarget: response.allowanceTarget, name: source.getMetadata().name, logoURI: source.getMetadata().logoURI },
    type: response.type,
    tx,
  };
}

function toAmountOfToken(token: BaseToken, price: number | undefined, amount: BigNumber) {
  const amountInUSD = amountToUSD(token.decimals, amount, price);
  return {
    amount,
    amountInUnits: parseFloat(utils.formatUnits(amount, token.decimals)),
    amountInUSD,
  };
}

function addForcedTimeout(sources: Record<AvailableSources, QuoteSource<QuoteSourceSupport, any>>) {
  return Object.fromEntries(Object.entries(sources).map(([id, source]) => [id, forcedTimeoutWrapper(source)])) as Record<
    AvailableSources,
    QuoteSource<QuoteSourceSupport, any>
  >;
}

function mapOrderToBigNumber(request: QuoteRequest): BuyOrder | SellOrder {
  return request.order.type === 'sell'
    ? { type: 'sell', sellAmount: BigNumber.from(request.order.sellAmount) }
    : { type: 'buy', buyAmount: BigNumber.from(request.order.buyAmount) };
}

function mapRequestToSourceRequest({
  request,
  sellTokenPromise,
  buyTokenPromise,
  gasPricePromise,
}: {
  request: QuoteRequest;
  sellTokenPromise: Promise<BaseToken>;
  buyTokenPromise: Promise<BaseToken>;
  gasPricePromise: Promise<GasPrice>;
}) {
  return {
    chain: Chains.byKeyOrFail(request.chainId),
    sellToken: request.sellToken,
    sellTokenData: sellTokenPromise,
    buyToken: request.buyToken,
    buyTokenData: buyTokenPromise,
    order: mapOrderToBigNumber(request),
    config: {
      slippagePercentage: request.slippagePercentage,
      txValidFor: request.txValidFor,
      timeout: request.quoteTimeout,
    },
    accounts: {
      takeFrom: request.takerAddress,
      recipient: request.recipient,
    },
    context: { gasPrice: gasPricePromise },
  } as SourceQuoteRequest<{ swapAndTransfer: true; buyOrders: true }>;
}
