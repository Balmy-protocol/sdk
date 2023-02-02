import { QuoteResponse, QuoteRequest, FailedQuote, SourceMetadata, SourceId } from '../types';

export type IQuoteSourceList = {
  supportedSources(): Record<SourceId, SourceMetadata>;
  getQuotes(request: SourceListRequest): Promise<QuoteResponse | FailedQuote>[];
  getAllQuotes(request: SourceListRequest): Promise<(QuoteResponse | FailedQuote)[]>;
};

export type SourceListRequest = Omit<QuoteRequest, 'filters' | 'includeNonTransferSourcesWhenRecipientIsSet'> & { sourceIds: SourceId[] };
