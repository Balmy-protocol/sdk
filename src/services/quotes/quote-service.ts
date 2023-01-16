import { chainsUnion, Chains } from '@chains';
import { IFetchService } from '@services/fetch/types';
import { GasPrice, IGasService, IQuickGasCostCalculator } from '@services/gas/types';
import { ChainId, Chain } from '@types';
import { BigNumber, utils } from 'ethers';
import { BuyOrder, QuoteSource, QuoteSourceSupport, SellOrder, SourceQuoteRequest, SourceQuoteResponse } from './quote-sources/base';
import { AllSourcesConfig, buildSources, SourcesBasedOnConfig } from './sources-list';
import {
  FailedQuote,
  GlobalQuoteSourceConfig,
  IQuoteService,
  QuoteRequest,
  QuoteResponse,
  TokenWithOptionalPrice,
  WithFailedQuotes,
} from './types';
import { BaseToken, ITokenService } from '@services/tokens/types';
import { Addresses } from '@shared/constants';
import { forcedTimeoutWrapper } from './quote-sources/wrappers/forced-timeout-wrapper';
import { buyToSellOrderWrapper } from './quote-sources/wrappers/buy-to-sell-order-wrapper';
import { amountToUSD, calculateGasDetails, filterRejectedResults } from '@shared/utils';
import { CompareQuotesBy, CompareQuotesUsing, sortQuotesBy } from './quote-compare';

type ConstructorParameters<CustomConfig extends Partial<AllSourcesConfig>> = {
  fetchService: IFetchService;
  gasService: IGasService;
  tokenService: ITokenService<TokenWithOptionalPrice>;
  config?: GlobalQuoteSourceConfig & CustomConfig;
};
export class QuoteService<Config extends Partial<AllSourcesConfig>> implements IQuoteService<SourcesBasedOnConfig<Config>> {
  private readonly fetchService: IFetchService;
  private readonly gasService: IGasService;
  private readonly tokenService: ITokenService<TokenWithOptionalPrice>;
  private readonly sources: Record<SourcesBasedOnConfig<Config>, QuoteSource<QuoteSourceSupport, any, any>>;

  constructor({ fetchService, gasService, tokenService, config }: ConstructorParameters<Config>) {
    this.sources = addForcedTimeout(buildSources<Config>(config ?? {}, config));
    this.fetchService = fetchService;
    this.gasService = gasService;
    this.tokenService = tokenService;
  }

  supportedChains(): ChainId[] {
    const supportedChains = Object.values(this.sources).map((source) => source.getMetadata().supports.chains.map((chain) => chain.chainId));
    return chainsUnion(supportedChains);
  }

  supportedSources(): SourcesBasedOnConfig<Config>[] {
    return Object.keys(this.sources) as SourcesBasedOnConfig<Config>[];
  }

  supportedSourcesInChain(chainId: ChainId): SourcesBasedOnConfig<Config>[] {
    return Object.entries(this.sources)
      .filter(([, source]) => source.getMetadata().supports.chains.some((chain) => chain.chainId === chainId))
      .map(([sourceId]) => sourceId as SourcesBasedOnConfig<Config>);
  }

  getQuotes(request: QuoteRequest<SourcesBasedOnConfig<Config>>): Promise<QuoteResponse>[] {
    return this.executeQuotes(request).map(({ response }) => response);
  }

  async getAllQuotes<IgnoreFailed extends boolean = true>(
    request: QuoteRequest<SourcesBasedOnConfig<Config>>,
    config?: { ignoredFailed?: IgnoreFailed; sort?: { by: CompareQuotesBy; using?: CompareQuotesUsing } }
  ): Promise<WithFailedQuotes<IgnoreFailed>[]> {
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

    return [...sortedQuotes, ...failedQuotes] as WithFailedQuotes<IgnoreFailed>[];
  }

  private executeQuotes(request: QuoteRequest<SourcesBasedOnConfig<Config>>) {
    // Ask for needed values, such as token data and gas price
    const tokensPromise = this.tokenService.getTokensForChain(request.chainId, [request.sellToken, request.buyToken, Addresses.NATIVE_TOKEN]);
    const sellTokenPromise = tokensPromise.then((tokens) => tokens[request.sellToken]);
    const buyTokenPromise = tokensPromise.then((tokens) => tokens[request.buyToken]);
    const gasPriceCalculatorPromise = this.gasService.getQuickGasCalculator(request.chainId);
    const gasPricePromise = gasPriceCalculatorPromise.then((calculator) => calculator.getGasPrice(request.gasSpeed));

    // Map request to source request
    const sourceRequest = mapRequestToSourceRequest({ request, sellTokenPromise, buyTokenPromise, gasPricePromise });

    // Ask for quotes
    const responses = this.getSourcesForRequest(request).map((source) => ({
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
    return responses.map(({ source, response }) => ({ source, response: mapSourceResponseToResponse({ source, request, response, values }) }));
  }

  private getSourcesForRequest(request: QuoteRequest<SourcesBasedOnConfig<Config>>) {
    let sourceIds: SourcesBasedOnConfig<Config>[] = this.supportedSourcesInChain(request.chainId);

    if (request.filters?.includeSources) {
      sourceIds = sourceIds.filter((id) => request.filters!.includeSources!.includes(id));
    } else if (request.filters?.excludeSources) {
      sourceIds = sourceIds.filter((id) => !request.filters!.excludeSources!.includes(id));
    }

    let sources = sourceIds.map((sourceId) => this.sources[sourceId]);

    if (request.order.type === 'buy') {
      if (request.estimateBuyOrdersWithSellOnlySources) {
        sources = sources.map(buyToSellOrderWrapper);
      } else {
        sources = sources.filter((source) => source.getMetadata().supports.buyOrders);
      }
    }

    if (request.recipient && request.recipient !== request.takerAddress && !request.includeNonTransferSourcesWhenRecipientIsSet) {
      sources = sources.filter((source) => source.getMetadata().supports.swapAndTransfer);
    }

    // Cast so that even if the source doesn't support it, everything else types ok
    return sources.map((source) => source as QuoteSource<{ buyOrders: true; swapAndTransfer: boolean }, any, any>);
  }
}

async function mapSourceResponseToResponse({
  source,
  request,
  response: responsePromise,
  values,
}: {
  source: QuoteSource<QuoteSourceSupport, any, any>;
  request: QuoteRequest<any>;
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
    to: response.swapper.address,
    from: request.takerAddress,
    value: response.value,
    data: response.calldata,
  };
  const { gasCostNativeToken, ...gasPrice } = gasCalculator.calculateGasCost(txData, response.estimatedGas, request.gasSpeed);
  const tx = { ...txData, ...gasPrice };
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
    swapper: { ...response.swapper, name: source.getMetadata().name, logoURI: source.getMetadata().logoURI },
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

function addForcedTimeout<Config extends Partial<AllSourcesConfig>>(
  sources: Record<SourcesBasedOnConfig<Config>, QuoteSource<QuoteSourceSupport, any, any>>
) {
  return Object.fromEntries(Object.entries(sources).map(([id, source]) => [id, forcedTimeoutWrapper(source)])) as Record<
    SourcesBasedOnConfig<Config>,
    QuoteSource<QuoteSourceSupport, any, any>
  >;
}

function mapOrderToBigNumber(request: QuoteRequest<any>): BuyOrder | SellOrder {
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
  request: QuoteRequest<any>;
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
