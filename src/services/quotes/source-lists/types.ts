import { ChainId } from '@types';
import { IndividualQuoteRequest, QuoteResponse, QuoteRequest, FailedQuote, SourceMetadata } from '../types';

export type ISourceList = {
  supportedChains(): Promise<ChainId[]>;
  supportedSources(): Promise<SourceMetadata[]>;
  getQuote(sourceId: string, request: IndividualQuoteRequest): Promise<QuoteResponse>;
  getQuotes(request: QuoteRequest): Promise<QuoteResponse | FailedQuote>[];
  getAllQuotes(request: QuoteRequest): Promise<(QuoteResponse | FailedQuote)[]>;
};
