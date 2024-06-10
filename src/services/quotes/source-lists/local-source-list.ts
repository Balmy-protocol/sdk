import { TimeString } from '@types';
import { QuoteResponseRelevant, QuoteTransaction, SourceId } from '../types';
import { IQuoteSourceList, SourceListBuildTxRequest, SourceListQuoteRequest, SourceListQuoteResponse } from './types';
import {
  BuyOrder,
  IQuoteSource,
  QuoteSourceSupport,
  SellOrder,
  SourceQuoteBuildTxRequest,
  SourceQuoteRequest,
  SourceQuoteResponse,
} from '../quote-sources/types';
import { timeoutPromise } from '@shared/timeouts';
import { getChainByKeyOrFail } from '@chains';
import { QUOTE_SOURCES, SourceConfig, SourceWithConfigId } from '../source-registry';
import { buyToSellOrderWrapper } from '@services/quotes/quote-sources/wrappers/buy-to-sell-order-wrapper';
import { forcedTimeoutWrapper } from '@services/quotes/quote-sources/wrappers/forced-timeout-wrapper';
import { IFetchService } from '@services/fetch/types';
import { IProviderService } from '@services/providers';
import { SourceInvalidConfigOrContextError, SourceNoBuyOrdersError, SourceNotFoundError } from '../errors';

type ConstructorParameters = {
  providerService: IProviderService;
  fetchService: IFetchService;
};

export class LocalSourceList implements IQuoteSourceList {
  private readonly providerService: IProviderService;
  private readonly fetchService: IFetchService;
  private readonly sources: Record<SourceId, IQuoteSource<QuoteSourceSupport, any>> = QUOTE_SOURCES;

  constructor({ providerService, fetchService }: ConstructorParameters) {
    this.providerService = providerService;
    this.fetchService = fetchService;
  }

  supportedSources() {
    const entries = Object.entries(this.sources).map(([sourceId, source]) => [sourceId, source.getMetadata()]);
    return Object.fromEntries(entries);
  }

  getQuotes(request: SourceListQuoteRequest): Record<SourceId, Promise<SourceListQuoteResponse>> {
    return Object.fromEntries(request.sources.map((sourceId) => [sourceId, this.getQuote(request, sourceId)]));
  }

  buildTxs(request: SourceListBuildTxRequest): Record<SourceId, Promise<QuoteTransaction>> {
    const entries = Object.entries(request.quotes).map<[SourceId, Promise<QuoteTransaction>]>(([sourceId, quote]) => [
      sourceId,
      quote.then((response) =>
        timeoutPromise(this.buildTx(sourceId, request.sourceConfig, response, request.quoteTimeout), request.quoteTimeout)
      ),
    ]);
    return Object.fromEntries(entries);
  }

  private async buildTx(
    sourceId: SourceId,
    sourceConfig: SourceConfig | undefined,
    quote: QuoteResponseRelevant,
    timeout: TimeString | undefined
  ): Promise<QuoteTransaction> {
    const source = this.sources[sourceId];

    if (!source) throw new SourceNotFoundError(sourceId);

    // Check config is valid
    const config = { ...sourceConfig?.global, ...sourceConfig?.custom?.[sourceId as SourceWithConfigId] };
    if (!source.isConfigAndContextValid(config)) {
      throw new SourceInvalidConfigOrContextError(sourceId);
    }

    // Map request to source request
    const sourceRequest = mapTxRequestToSourceRequest(quote, timeout);
    const tx = source.buildTx({
      components: { providerService: this.providerService, fetchService: this.fetchService },
      config,
      request: sourceRequest,
    });

    const { to, calldata, value } = await tx;
    return { to, data: calldata, value, from: quote.accounts.takerAddress };
  }

  private async getQuote(request: SourceListQuoteRequest, sourceId: SourceId): Promise<SourceListQuoteResponse> {
    if (!(sourceId in this.sources)) {
      throw new SourceNotFoundError(sourceId);
    }

    // Map request to source request
    const sourceRequest = mapQuoteRequestToSourceRequest(request);

    // Find and wrap source
    const source = this.getSourceForRequest(request, sourceId);

    // Check config is valid
    const config = { ...request.sourceConfig?.global, ...request.sourceConfig?.custom?.[sourceId as SourceWithConfigId] };
    if (!source.isConfigAndContextValid(config)) {
      throw new SourceInvalidConfigOrContextError(sourceId);
    }

    // Ask for quote
    const response = await source.quote({
      components: { providerService: this.providerService, fetchService: this.fetchService },
      config,
      request: sourceRequest,
    });

    // Map to response
    return mapSourceResponseToResponse({ request, source, response, sourceId });
  }

  private getSourceForRequest(request: SourceListQuoteRequest, sourceId: SourceId) {
    let source = this.sources[sourceId];

    if (request.order.type === 'buy' && !source.getMetadata().supports.buyOrders) {
      if (request.estimateBuyOrdersWithSellOnlySources) {
        source = buyToSellOrderWrapper(source);
      } else {
        throw new SourceNoBuyOrdersError(sourceId);
      }
    }
    // Cast so that even if the source doesn't support it, everything else types ok
    return forcedTimeoutWrapper(source as IQuoteSource<{ buyOrders: true; swapAndTransfer: boolean }>);
  }
}

function mapSourceResponseToResponse({
  source,
  request,
  response,
  sourceId,
}: {
  source: IQuoteSource<QuoteSourceSupport>;
  request: SourceListQuoteRequest;
  response: SourceQuoteResponse<Record<string, any>>;
  sourceId: SourceId;
}): SourceListQuoteResponse {
  const recipient = request.recipient && source.getMetadata().supports.swapAndTransfer ? request.recipient : request.takerAddress;
  return {
    sellAmount: response.sellAmount,
    buyAmount: response.buyAmount,
    maxSellAmount: response.maxSellAmount,
    minBuyAmount: response.minBuyAmount,
    estimatedGas: response.estimatedGas,
    recipient,
    source: {
      id: sourceId,
      allowanceTarget: response.allowanceTarget,
      name: source.getMetadata().name,
      logoURI: source.getMetadata().logoURI,
    },
    type: response.type,
    customData: response.customData,
  };
}

function mapOrderToBigNumber(request: SourceListQuoteRequest): BuyOrder | SellOrder {
  return request.order.type === 'sell'
    ? { type: 'sell', sellAmount: BigInt(request.order.sellAmount) }
    : { type: 'buy', buyAmount: BigInt(request.order.buyAmount) };
}

function mapTxRequestToSourceRequest(
  response: QuoteResponseRelevant,
  timeout: TimeString | undefined
): SourceQuoteBuildTxRequest<Record<string, any>> {
  return {
    chain: getChainByKeyOrFail(response.chainId),
    sellToken: response.sellToken.address,
    buyToken: response.buyToken.address,
    type: response.type,
    sellAmount: response.sellAmount.amount,
    maxSellAmount: response.maxSellAmount.amount,
    buyAmount: response.buyAmount.amount,
    minBuyAmount: response.minBuyAmount.amount,
    accounts: { takeFrom: response.accounts.takerAddress, recipient: response.accounts.recipient },
    customData: response.customData,
    config: { timeout },
  };
}

function mapQuoteRequestToSourceRequest(request: SourceListQuoteRequest) {
  return {
    chain: getChainByKeyOrFail(request.chainId),
    sellToken: request.sellToken,
    buyToken: request.buyToken,
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
    external: request.external,
  } as SourceQuoteRequest<{ swapAndTransfer: true; buyOrders: true }>;
}
