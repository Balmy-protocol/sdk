import {
  FailedQuote,
  GlobalQuoteSourceConfig,
  IndividualQuoteRequest,
  QuoteRequest,
  QuoteResponse,
  QuoteTx,
  SourceMetadata,
  TokenWithOptionalPrice,
} from '../../types';
import { ISourceList } from '../types';
import { BuyOrder, QuoteSource, QuoteSourceSupport, SellOrder, SourceQuoteRequest, SourceQuoteResponse } from '../../quote-sources/base';
import { ChainId } from '@types';
import { Chains, chainsUnion } from '@chains';
import { amountToUSD, calculateGasDetails, isSameAddress } from '@shared/utils';
import { AllSourcesConfig, buildSources } from './source-registry';
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
  config?: GlobalQuoteSourceConfig & Partial<AllSourcesConfig>;
};
export class DefaultSourceList implements ISourceList {
  private readonly fetchService: IFetchService;
  private readonly gasService: IGasService;
  private readonly tokenService: ITokenService<TokenWithOptionalPrice>;
  private readonly sources: Record<string, QuoteSource<QuoteSourceSupport, any>>;

  constructor({ fetchService, gasService, tokenService, config }: ConstructorParameters) {
    this.fetchService = fetchService;
    this.gasService = gasService;
    this.tokenService = tokenService;
    this.sources = addForcedTimeout(buildSources(config));
  }

  async supportedChains(): Promise<ChainId[]> {
    const supportedChains = Object.values(this.sources).map((source) => source.getMetadata().supports.chains.map((chain) => chain.chainId));
    return chainsUnion(supportedChains);
  }

  async supportedSources(): Promise<SourceMetadata[]> {
    return Object.entries(this.sources).map(([sourceId, source]) => buildMetadata(sourceId, source));
  }

  async getQuote(sourceId: string, request: IndividualQuoteRequest): Promise<QuoteResponse> {
    if (!(sourceId in this.sources)) {
      throw new Error(`Could not find a source with '${sourceId}'`);
    }

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

    const quote = await quotes[0];

    if ('failed' in quote) {
      throw new Error(`Failed to generate quote ${quote.error ? `'${quote.error}'` : ''}`);
    }

    return quote;
  }

  getQuotes(request: QuoteRequest): Promise<QuoteResponse | FailedQuote>[] {
    return this.executeQuotes(request);
  }

  getAllQuotes(request: QuoteRequest): Promise<(QuoteResponse | FailedQuote)[]> {
    return Promise.all(this.getQuotes(request));
  }

  private executeQuotes(request: QuoteRequest): Promise<QuoteResponse | FailedQuote>[] {
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
    return responses.map(({ sourceId, source, response }) =>
      mapSourceResponseToResponse({ sourceId, source, request, response, values }).catch((e) => ({
        failed: true,
        name: source.getMetadata().name,
        logoURI: source.getMetadata().logoURI,
        error: e,
      }))
    );
  }

  private getSourcesForRequest(request: QuoteRequest) {
    let sourceIds = Object.entries(this.sources)
      .filter(([, source]) => source.getMetadata().supports.chains.some((chain) => chain.chainId === request.chainId))
      .map(([sourceId]) => sourceId);

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
  sourceId: string;
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

function buildMetadata(sourceId: string, source: QuoteSource<QuoteSourceSupport>) {
  const {
    supports: { chains, ...supports },
    ...metadata
  } = source.getMetadata();
  return { ...metadata, id: sourceId, supports: { ...supports, chains: chains.map(({ chainId }) => chainId) } };
}

function addForcedTimeout(sources: Record<string, QuoteSource<QuoteSourceSupport>>) {
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
