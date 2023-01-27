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
} from './types';
import { CompareQuotesBy, CompareQuotesUsing, sortQuotesBy } from './quote-compare';
import { ISourceList } from './source-lists/types';

export class QuoteService implements IQuoteService {
  constructor(private readonly sourceList: ISourceList) {}

  supportedChains() {
    return this.sourceList.supportedChains();
  }

  supportedSources() {
    return this.sourceList.supportedSources();
  }

  async supportedSourcesInChain(chainId: ChainId) {
    const sources = await this.sourceList.supportedSources();
    return sources.filter(({ supports }) => supports.chains.includes(chainId));
  }

  getQuote(sourceId: string, request: IndividualQuoteRequest): Promise<QuoteResponse> {
    return this.sourceList.getQuote(sourceId, request);
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
    return this.sourceList.getQuotes(request);
  }

  async getAllQuotes<IgnoreFailed extends boolean = true>(
    request: QuoteRequest,
    config?: { ignoredFailed?: IgnoreFailed; sort?: { by: CompareQuotesBy; using?: CompareQuotesUsing } }
  ): Promise<IgnoreFailedQuotes<IgnoreFailed, QuoteResponse>[]> {
    const responses = await this.sourceList.getAllQuotes(request);
    const successfulQuotes = responses.filter((response): response is QuoteResponse => !('failed' in response));
    const failedQuotes = config?.ignoredFailed === false ? responses.filter((response): response is FailedQuote => 'failed' in response) : [];

    const sortedQuotes = sortQuotesBy(
      successfulQuotes,
      config?.sort?.by ?? 'most-swapped-accounting-for-gas',
      config?.sort?.using ?? 'sell/buy amounts'
    );

    return [...sortedQuotes, ...failedQuotes] as IgnoreFailedQuotes<IgnoreFailed, QuoteResponse>[];
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
