import { FailedQuote, GlobalQuoteSourceConfig, QuoteRequest, QuoteResponse, QuoteTx, SourceId, TokenWithOptionalPrice } from '../types';
import { IQuoteSourceList, SourceListRequest } from './types';
import {
  BuyOrder,
  QuoteSource,
  QuoteSourceMetadata,
  QuoteSourceSupport,
  SellOrder,
  SourceQuoteRequest,
  SourceQuoteResponse,
} from '../quote-sources/base';
import { getChainByKeyOrFail } from '@chains';
import { amountToUSD, calculateGasDetails } from '@shared/utils';
import { DefaultSourcesConfig, buildSources } from '../source-registry';
import { IQuickGasCostCalculator, GasPrice, IGasService } from '@services/gas/types';
import { buyToSellOrderWrapper } from '@services/quotes/quote-sources/wrappers/buy-to-sell-order-wrapper';
import { forcedTimeoutWrapper } from '@services/quotes/quote-sources/wrappers/forced-timeout-wrapper';
import { BaseTokenMetadata, ITokenService } from '@services/tokens/types';
import { Addresses } from '@shared/constants';
import { BigNumber, utils } from 'ethers';
import { IFetchService } from '@services/fetch/types';
import { IProviderSource } from '@services/providers';
import { reduceTimeout } from '@shared/timeouts';

type ConstructorParameters = {
  providerSource: IProviderSource;
  fetchService: IFetchService;
  gasService: IGasService;
  tokenService: ITokenService<TokenWithOptionalPrice>;
  config?: GlobalQuoteSourceConfig & Partial<DefaultSourcesConfig>;
};
export class DefaultSourceList implements IQuoteSourceList {
  private readonly providerSource: IProviderSource;
  private readonly fetchService: IFetchService;
  private readonly gasService: IGasService;
  private readonly tokenService: ITokenService<TokenWithOptionalPrice>;
  private readonly sources: Record<SourceId, QuoteSource<QuoteSourceSupport, any>>;

  constructor({ providerSource, fetchService, gasService, tokenService, config }: ConstructorParameters) {
    this.providerSource = providerSource;
    this.fetchService = fetchService;
    this.gasService = gasService;
    this.tokenService = tokenService;
    this.sources = addForcedTimeout(buildSources(config));
  }

  supportedSources() {
    // We need the token service in order to return a quote, so we'll filter out chains where the token service is not available
    const supportedChains = Object.keys(this.tokenService.tokenProperties()).map(Number);
    const filterOutUnsupportedChains = <Support extends QuoteSourceSupport>(metadata: QuoteSourceMetadata<Support>) => ({
      ...metadata,
      supports: {
        ...metadata.supports,
        chains: metadata.supports.chains.filter((chainId) => supportedChains.includes(chainId)),
      },
    });
    const entries = Object.entries(this.sources).map(([sourceId, source]) => [sourceId, filterOutUnsupportedChains(source.getMetadata())]);
    return Object.fromEntries(entries);
  }

  getQuotes(request: SourceListRequest): Promise<QuoteResponse | FailedQuote>[] {
    return this.executeQuotes(request);
  }

  getAllQuotes(request: SourceListRequest): Promise<(QuoteResponse | FailedQuote)[]> {
    return Promise.all(this.getQuotes(request));
  }

  private executeQuotes(request: SourceListRequest): Promise<QuoteResponse | FailedQuote>[] {
    const reducedTimeout = reduceTimeout(request.quoteTimeout, '100');
    const filteredSourceIds = request.sourceIds.filter((sourceId) => sourceId in this.sources);
    if (filteredSourceIds.length === 0) return [];

    // Ask for needed values, such as token data and gas price
    const tokensPromise = this.tokenService.getTokensForChain({
      chainId: request.chainId,
      addresses: [request.sellToken, request.buyToken, Addresses.NATIVE_TOKEN],
      config: { timeout: reducedTimeout },
    });
    const sellTokenPromise = tokensPromise.then((tokens) => tokens[request.sellToken]);
    const buyTokenPromise = tokensPromise.then((tokens) => tokens[request.buyToken]);
    // TODO: Add timeout to gas service when available
    const gasPriceCalculatorPromise = this.gasService.getQuickGasCalculator({ chainId: request.chainId });
    const gasPricePromise = gasPriceCalculatorPromise.then((calculator) => calculator.getGasPrice({ speed: request.gasSpeed }));

    // Map request to source request
    const sourceRequest = mapRequestToSourceRequest({ request, sellTokenPromise, buyTokenPromise, gasPricePromise });

    // Ask for quotes
    const responses = this.getSourcesForRequest(request).map(({ sourceId, source }) => ({
      sourceId,
      source,
      response: source.quote(
        { providerSource: this.providerSource, gasService: this.gasService, fetchService: this.fetchService },
        sourceRequest
      ),
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
  const [response, { sellToken, buyToken, gasCalculator, nativeTokenPrice }] = await Promise.all([responsePromise, values]);
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
  // TODO: We should add the gas price to the tx, but if we do, we get some weird errors. Investigate and add it to to the tx
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
      ...calculateGasDetails(getChainByKeyOrFail(request.chainId), gasCostNativeToken, nativeTokenPrice),
    },
    recipient,
    source: { id: sourceId, allowanceTarget: response.allowanceTarget, name: source.getMetadata().name, logoURI: source.getMetadata().logoURI },
    type: response.type,
    tx,
  };
}

function toAmountOfToken(token: BaseTokenMetadata, price: number | undefined, amount: BigNumber) {
  const amountInUSD = amountToUSD(token.decimals, amount, price);
  return {
    amount: amount.toString(),
    amountInUnits: utils.formatUnits(amount, token.decimals),
    amountInUSD,
  };
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
  sellTokenPromise: Promise<BaseTokenMetadata>;
  buyTokenPromise: Promise<BaseTokenMetadata>;
  gasPricePromise: Promise<GasPrice>;
}) {
  return {
    chain: getChainByKeyOrFail(request.chainId),
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
