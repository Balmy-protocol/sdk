import { GlobalQuoteSourceConfig, QuoteTx, SourceId } from '../types';
import { IQuoteSourceList, SourceListRequest, SourceListResponse } from './types';
import { BuyOrder, QuoteSource, QuoteSourceSupport, SellOrder, SourceQuoteRequest, SourceQuoteResponse } from '../quote-sources/base';
import { getChainByKeyOrFail } from '@chains';
import { LocalSourcesConfig, buildSources } from '../source-registry';
import { buyToSellOrderWrapper } from '@services/quotes/quote-sources/wrappers/buy-to-sell-order-wrapper';
import { forcedTimeoutWrapper } from '@services/quotes/quote-sources/wrappers/forced-timeout-wrapper';
import { BigNumber } from 'ethers';
import { IFetchService } from '@services/fetch/types';
import { IProviderSource } from '@services/providers';

type ConstructorParameters = {
  providerSource: IProviderSource;
  fetchService: IFetchService;
  config?: GlobalQuoteSourceConfig & Partial<LocalSourcesConfig>;
};

export class LocalSourceList implements IQuoteSourceList {
  private readonly providerSource: IProviderSource;
  private readonly fetchService: IFetchService;
  private readonly sources: Record<SourceId, QuoteSource<QuoteSourceSupport, any>>;

  constructor({ providerSource, fetchService, config }: ConstructorParameters) {
    this.providerSource = providerSource;
    this.fetchService = fetchService;
    this.sources = buildSources(config);
  }

  supportedSources() {
    const entries = Object.entries(this.sources).map(([sourceId, source]) => [sourceId, source.getMetadata()]);
    return Object.fromEntries(entries);
  }

  async getQuote(request: SourceListRequest): Promise<SourceListResponse> {
    if (!(request.sourceId in this.sources)) {
      throw new Error(`Source with id '${request.sourceId} is not supported`);
    }

    // Map request to source request
    const sourceRequest = mapRequestToSourceRequest(request);

    // Find and wrap source
    const source = this.getSourceForRequest(request);

    // Ask for quote
    const response = await source.quote({ providerSource: this.providerSource, fetchService: this.fetchService }, sourceRequest);

    // Map to response
    return mapSourceResponseToResponse({ request, source, response });
  }

  private getSourceForRequest(request: SourceListRequest) {
    let source = this.sources[request.sourceId];

    if (request.order.type === 'buy' && !source.getMetadata().supports.buyOrders) {
      if (request.estimateBuyOrdersWithSellOnlySources) {
        source = buyToSellOrderWrapper(source);
      } else {
        throw new Error(`Source with id '${request.sourceId}' does not support buy orders. Do you want to estimate buy orders?`);
      }
    }
    // Cast so that even if the source doesn't support it, everything else types ok
    return forcedTimeoutWrapper(source as QuoteSource<{ buyOrders: true; swapAndTransfer: boolean }>);
  }
}

async function mapSourceResponseToResponse({
  source,
  request,
  response,
}: {
  source: QuoteSource<QuoteSourceSupport>;
  request: SourceListRequest;
  response: SourceQuoteResponse;
}): Promise<SourceListResponse> {
  const tx: QuoteTx = {
    to: response.tx.to,
    value: response.tx.value?.toString(),
    data: response.tx.calldata,
    from: request.takerAddress,
  };
  const recipient = request.recipient && source.getMetadata().supports.swapAndTransfer ? request.recipient : request.takerAddress;
  return {
    sellAmount: response.sellAmount.toString(),
    buyAmount: response.buyAmount.toString(),
    maxSellAmount: response.maxSellAmount.toString(),
    minBuyAmount: response.minBuyAmount.toString(),
    estimatedGas: response.estimatedGas.toString(),
    recipient,
    source: {
      id: request.sourceId,
      allowanceTarget: response.allowanceTarget,
      name: source.getMetadata().name,
      logoURI: source.getMetadata().logoURI,
    },
    type: response.type,
    tx,
  };
}

function mapOrderToBigNumber(request: SourceListRequest): BuyOrder | SellOrder {
  return request.order.type === 'sell'
    ? { type: 'sell', sellAmount: BigNumber.from(request.order.sellAmount) }
    : { type: 'buy', buyAmount: BigNumber.from(request.order.buyAmount) };
}

function mapRequestToSourceRequest(request: SourceListRequest) {
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
