import { TimeString } from '@types';
import { reduceTimeout } from '@shared/timeouts';
import { QuoteResponseRelevantForTxBuild, QuoteTransaction, SourceId, SourceMetadata } from '../types';
import { IQuoteSourceList, SourceListBuildTxRequest, SourceListQuoteRequest, SourceListQuoteResponse } from './types';
import { IFetchService } from '@services/fetch/types';
import { StringifyBigInt } from '@utility-types';
import { bigintifyQuote, bigintifyTx } from './utils';
import { SourceConfig } from '../source-registry';

export type URIGenerator<T> = (request: T) => string;
type ConstructorParameters = {
  fetchService: IFetchService;
  getQuotesURI: URIGenerator<BatchAPISourceListQuoteRequest>;
  buildTxURI: URIGenerator<BatchAPISourceListBuildTxRequest>;
  sources: Record<SourceId, SourceMetadata>;
};
export class BatchAPISourceList implements IQuoteSourceList {
  private readonly fetchService: IFetchService;
  private readonly getQuotesURI: URIGenerator<BatchAPISourceListQuoteRequest>;
  private readonly buildTxURI: URIGenerator<BatchAPISourceListBuildTxRequest>;
  private readonly sources: Record<SourceId, SourceMetadata>;

  constructor({ fetchService, getQuotesURI, buildTxURI, sources }: ConstructorParameters) {
    this.fetchService = fetchService;
    this.getQuotesURI = getQuotesURI;
    this.buildTxURI = buildTxURI;
    this.sources = sources;
  }

  supportedSources() {
    return this.sources;
  }

  getQuotes(request: SourceListQuoteRequest): Record<SourceId, Promise<SourceListQuoteResponse>> {
    // We reduce the request a little bit so that the server tries to be faster that the timeout
    const reducedTimeout = reduceTimeout(request.quoteTimeout, '500');
    const uri = this.getQuotesURI(request);
    const response = this.fetchService.fetch(uri, {
      method: 'POST',
      body: JSON.stringify({
        ...request,
        quoteTimeout: reducedTimeout,
      }),
      timeout: request.quoteTimeout,
    });
    const result: Promise<Record<SourceId, StringifyBigInt<SourceListQuoteResponse>>> = response.then((result) => result.json());
    return Object.fromEntries(request.sources.map((sourceId) => [sourceId, result.then((responses) => bigintifyQuote(responses[sourceId]))]));
  }

  buildTxs(request: SourceListBuildTxRequest): Record<SourceId, Promise<QuoteTransaction>> {
    const result = this.fetchTxs(request);
    return Object.fromEntries(
      Object.keys(request.quotes).map((sourceId) => [sourceId, result.then((responses) => bigintifyTx(responses[sourceId]))])
    );
  }

  private async fetchTxs(request: SourceListBuildTxRequest): Promise<Record<SourceId, StringifyBigInt<QuoteTransaction>>> {
    const entries = await Promise.all(
      Object.entries(request.quotes).map<Promise<[SourceId, QuoteResponseRelevantForTxBuild]>>(async ([sourceId, quotePromise]) => [
        sourceId,
        await quotePromise,
      ])
    );

    // We reduce the request a little bit so that the server tries to be faster that the timeout
    const reducedTimeout = reduceTimeout(request.quoteTimeout, '500');
    const apiRequest: BatchAPISourceListBuildTxRequest = {
      sourceConfig: request.sourceConfig,
      quotes: Object.fromEntries(entries),
      quoteTimeout: reducedTimeout,
    };

    const uri = this.buildTxURI(apiRequest);
    const response = this.fetchService.fetch(uri, {
      method: 'POST',
      body: JSON.stringify(apiRequest),
      timeout: request.quoteTimeout,
    });
    return response.then((result) => result.json());
  }
}

export type BatchAPISourceListQuoteRequest = Omit<SourceListQuoteRequest, 'external'>;
export type BatchAPISourceListBuildTxRequest = {
  sourceConfig?: SourceConfig;
  quotes: Record<SourceId, QuoteResponseRelevantForTxBuild>;
  quoteTimeout?: TimeString;
};
