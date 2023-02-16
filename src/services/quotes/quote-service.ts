import { ChainId } from '@types';
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
} from './types';
import { CompareQuotesBy, CompareQuotesUsing, sortQuotesBy } from './quote-compare';
import { IQuoteSourceList } from './source-lists/types';
import { chainsUnion } from '@chains';
import { isSameAddress } from '@shared/utils';

export class QuoteService implements IQuoteService {
  constructor(private readonly sourceList: IQuoteSourceList) {}

  supportedSources() {
    return this.sourceList.supportedSources();
  }

  supportedChains() {
    const allChains = Object.values(this.supportedSources()).map(({ supports: { chains } }) => chains);
    return chainsUnion(allChains);
  }

  supportedSourcesInChain(chainId: ChainId) {
    const sourcesInChain = Object.entries(this.sourceList.supportedSources()).filter(([, source]) => source.supports.chains.includes(chainId));
    return Object.fromEntries(sourcesInChain);
  }

  async getQuote(sourceId: SourceId, request: IndividualQuoteRequest): Promise<QuoteResponse> {
    const sources = this.supportedSources();
    if (!(sourceId in sources)) {
      throw new Error(`Could not find a source with '${sourceId}'`);
    }

    const sourceSupport = sources[sourceId].supports;
    const supportedChains = sourceSupport.chains.map((chainId) => chainId);
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

  estimateQuotes(estimatedRequest: EstimatedQuoteRequest) {
    return this.getQuotes(estimatedToQuoteRequest(estimatedRequest)).map((response) =>
      response.then((response) => ('failed' in response ? response : quoteResponseToEstimated(response)))
    );
  }

  async estimateAllQuotes<IgnoreFailed extends boolean = true>(
    estimatedRequest: EstimatedQuoteRequest,
    config?: { ignoredFailed?: IgnoreFailed; sort?: { by: CompareQuotesBy; using?: CompareQuotesUsing } }
  ): Promise<IgnoreFailedQuotes<IgnoreFailed, EstimatedQuoteResponse>[]> {
    const allResponses = await this.getAllQuotes(estimatedToQuoteRequest(estimatedRequest), config);
    return allResponses.map((response) => ('failed' in response ? response : quoteResponseToEstimated(response)));
  }

  getQuotes(request: QuoteRequest) {
    return this.sourceList.getQuotes(this.mapRequest(request));
  }

  async getAllQuotes<IgnoreFailed extends boolean = true>(
    request: QuoteRequest,
    config?: { ignoredFailed?: IgnoreFailed; sort?: { by: CompareQuotesBy; using?: CompareQuotesUsing } }
  ): Promise<IgnoreFailedQuotes<IgnoreFailed, QuoteResponse>[]> {
    const responses = await this.sourceList.getAllQuotes(this.mapRequest(request));
    const successfulQuotes = responses.filter((response): response is QuoteResponse => !('failed' in response));
    const failedQuotes = config?.ignoredFailed === false ? responses.filter((response): response is FailedQuote => 'failed' in response) : [];

    const sortedQuotes = sortQuotesBy(
      successfulQuotes,
      config?.sort?.by ?? 'most-swapped-accounting-for-gas',
      config?.sort?.using ?? 'sell/buy amounts'
    );

    return [...sortedQuotes, ...failedQuotes] as IgnoreFailedQuotes<IgnoreFailed, QuoteResponse>[];
  }

  private mapRequest({ filters, includeNonTransferSourcesWhenRecipientIsSet, estimateBuyOrdersWithSellOnlySources, ...request }: QuoteRequest) {
    const sourcesInChain = this.supportedSourcesInChain(request.chainId);
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

    return {
      ...request,
      sourceIds,
      estimateBuyOrdersWithSellOnlySources,
    };
  }
}

function estimatedToQuoteRequest(request: EstimatedQuoteRequest): QuoteRequest {
  return {
    ...request,
    takerAddress: '0x000000000000000000000000000000000000dEaD', // We set a random taker address so that txs can be built at the source level
  };
}

function quoteResponseToEstimated({ recipient, tx, ...response }: QuoteResponse): EstimatedQuoteResponse {
  return response;
}
