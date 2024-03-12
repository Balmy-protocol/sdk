import { reduceTimeout } from '@shared/timeouts';
import { SourceId, SourceMetadata } from '../types';
import { IQuoteSourceList, SourceListRequest, SourceListResponse } from './types';
import { IFetchService } from '@services/fetch/types';
import { PartialOnly } from '@utility-types';

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
    const reducedTimeout = reduceTimeout(request.quoteTimeout, '100');
    const uri = this.baseUri(request);
    const response = await this.fetchService.fetch(uri, {
      method: 'POST',
      body: JSON.stringify({
        ...request,
        quoteTimeout: reducedTimeout,
      }),
      timeout: request.quoteTimeout,
    });
    return response.json();
  }
}
