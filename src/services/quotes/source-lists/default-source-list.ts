import { FailedQuote, GlobalQuoteSourceConfig, QuoteRequest, QuoteResponse, QuoteTx, SourceId, TokenWithOptionalPrice } from '../types';
import { IQuoteSourceList, SourceListRequest } from './types';
import { BuyOrder, QuoteSource, QuoteSourceSupport, SellOrder, SourceQuoteRequest, SourceQuoteResponse } from '../quote-sources/base';
import { Chains } from '@chains';
import { amountToUSD, calculateGasDetails } from '@shared/utils';
import { DefaultSourcesConfig, buildSources } from '../source-registry';
import { IQuickGasCostCalculator, GasPrice, IGasService } from '@services/gas/types';
import { buyToSellOrderWrapper } from '@services/quotes/quote-sources/wrappers/buy-to-sell-order-wrapper';
import { forcedTimeoutWrapper } from '@services/quotes/quote-sources/wrappers/forced-timeout-wrapper';
import { BaseToken, ITokenService } from '@services/tokens/types';
import { Addresses } from '@shared/constants';
import { BigNumber, utils } from 'ethers';
import { IFetchService } from '@services/fetch/types';

type ConstructorParameters = {
  fetchService: IFetchService;
  gasService: IGasService;
  tokenService: ITokenService<TokenWithOptionalPrice>;
  config?: GlobalQuoteSourceConfig & Partial<DefaultSourcesConfig>;
};
export class DefaultSourceList implements IQuoteSourceList {
  private readonly fetchService: IFetchService;
  private readonly gasService: IGasService;
  private readonly tokenService: ITokenService<TokenWithOptionalPrice>;
  private readonly sources: Record<SourceId, QuoteSource<QuoteSourceSupport, any>>;

  constructor({ fetchService, gasService, tokenService, config }: ConstructorParameters) {
    this.fetchService = fetchService;
    this.gasService = gasService;
    this.tokenService = tokenService;
    this.sources = addForcedTimeout(buildSources(config));
  }

  supportedSources() {
    const entries = Object.entries(this.sources).map(([sourceId, source]) => [sourceId, buildMetadata(source)]);
    return Object.fromEntries(entries);
  }

  getQuotes(request: SourceListRequest): Promise<QuoteResponse | FailedQuote>[] {
    return this.executeQuotes(request);
  }

  getAllQuotes(request: SourceListRequest): Promise<(QuoteResponse | FailedQuote)[]> {
    return Promise.all(this.getQuotes(request));
  }

  private executeQuotes(request: SourceListRequest): Promise<QuoteResponse | FailedQuote>[] {
    // Ask for needed values, such as token data and gas price
    const tokensPromise = this.tokenService.getTokensForChain({
      chainId: request.chainId,
      addresses: [request.sellToken, request.buyToken, Addresses.NATIVE_TOKEN],
    });
    const sellTokenPromise = tokensPromise.then((tokens) => tokens[request.sellToken]);
    const buyTokenPromise = tokensPromise.then((tokens) => tokens[request.buyToken]);
    const gasPriceCalculatorPromise = this.gasService.getQuickGasCalculator({ chainId: request.chainId });
    const gasPricePromise = gasPriceCalculatorPromise.then((calculator) => calculator.getGasPrice({ speed: request.gasSpeed }));

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
    return responses.map(({ sourceId, source, response }) =>
      mapSourceResponseToResponse({ sourceId, source, request, response, values }).catch((e) => ({
        failed: true,
        name: source.getMetadata().name,
        logoURI: source.getMetadata().logoURI,
        error: e instanceof Error ? e.message : JSON.stringify(e),
      }))
    );
  }

  private getSourcesForRequest(request: SourceListRequest) {
    let sources = request.sourceIds.map((sourceId) => ({ sourceId, source: this.sources[sourceId] })).filter(({ source }) => !!source);

    if (request.order.type === 'buy') {
      if (request.estimateBuyOrdersWithSellOnlySources) {
        sources = sources.map(({ sourceId, source }) => ({
          sourceId,
          source: source.getMetadata().supports.buyOrders ? source : buyToSellOrderWrapper(source),
        }));
      } else {
        sources = sources.filter(({ source }) => source.getMetadata().supports.buyOrders);
      }
    }
    // Cast so that even if the source doesn't support it, everything else types ok
    return sources.map(({ sourceId, source }) => ({
      sourceId,
      source: source as QuoteSource<{ buyOrders: true; swapAndTransfer: boolean }>,
    }));
  }
}

async function mapSourceResponseToResponse({
  sourceId,
  source,
  request,
  response: responsePromise,
  values,
}: {
  sourceId: SourceId;
  source: QuoteSource<QuoteSourceSupport>;
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
    case Chains.POLYGON.chainId:
      // Do nothing, don't want to add the gas price here
      // For some reason, some wallets fail when you add the gas price on these chains
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
      estimatedGas: response.estimatedGas.toString(),
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
    amount: amount.toString(),
    amountInUnits: utils.formatUnits(amount, token.decimals),
    amountInUSD,
  };
}

function buildMetadata(source: QuoteSource<QuoteSourceSupport>) {
  const {
    supports: { chains, ...supports },
    ...metadata
  } = source.getMetadata();
  return { ...metadata, supports: { ...supports, chains: chains.map(({ chainId }) => chainId) } };
}

function addForcedTimeout(sources: Record<SourceId, QuoteSource<QuoteSourceSupport>>) {
  return Object.fromEntries(Object.entries(sources).map(([id, source]) => [id, forcedTimeoutWrapper(source)]));
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
