import { reduceTimeout } from '@shared/timeouts';
import { SourceId, SourceMetadata } from '../types';
import { IQuoteSourceList, SourceListRequest, SourceListResponse, StringifiedSourceListResponse } from './types';
import { IFetchService } from '@services/fetch/types';
import { PartialOnly } from '@utility-types';
import { SourceWithConfigId } from '../source-registry';
import { bigintifyQuote } from './utils';

export type APISourceListRequest = PartialOnly<SourceListRequest, 'external'>;
type SingleSourceListRequest = PartialOnly<APISourceListRequest, 'sources'> & { sourceId: SourceId };
export type URIGenerator = (request: SingleSourceListRequest) => string;
type ConstructorParameters = {
  fetchService: IFetchService;
  baseUri: URIGenerator;
  sources: Record<SourceId, SourceMetadata>;
};
export class APISourceList implements IQuoteSourceList {
  private readonly fetchService: IFetchService;
  private readonly baseUri: URIGenerator;
  private readonly sources: Record<SourceId, SourceMetadata>;

  constructor({ fetchService, baseUri, sources }: ConstructorParameters) {
    this.fetchService = fetchService;
    this.baseUri = baseUri;
    this.sources = sources;
  }

  supportedSources() {
    return this.sources;
  }

  getQuotes(request: APISourceListRequest): Record<SourceId, Promise<SourceListResponse>> {
    const quotePromises = request.sources.map((sourceId) => [sourceId, this.getQuote({ ...request, sourceId })]);
    return Object.fromEntries(quotePromises);
  }
  private async getQuote(request: SingleSourceListRequest): Promise<SourceListResponse> {
    // We reduce the request a little bit so that the server tries to be faster that the timeout
    const reducedTimeout = reduceTimeout(request.quoteTimeout, '500');
    const uri = this.baseUri(request);
    const response = await this.fetchService.fetch(uri, {
      method: 'POST',
      body: JSON.stringify({
        ...request,
        quoteTimeout: reducedTimeout,
        sourceConfig: { ...request.sourceConfig?.global, ...request.sourceConfig?.custom?.[request.sourceId as SourceWithConfigId] },
      }),
      timeout: request.quoteTimeout,
    });
    const quote: StringifiedSourceListResponse = await response.json();
    return bigintifyQuote(quote);
  }
}
