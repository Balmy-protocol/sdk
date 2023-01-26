import { QuoteSource, QuoteSourceSupport } from '../quote-sources/base';

export type ISourceList = {
  getSources(): Promise<Record<string, QuoteSource<QuoteSourceSupport>>>;
};
