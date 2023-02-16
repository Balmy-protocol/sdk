import { reduceTimeout } from '@shared/timeouts';
import { FailedQuote, QuoteResponse, SourceId, SourceMetadata } from '../types';
import { IQuoteSourceList, SourceListRequest } from './types';
import { IFetchService } from '@services/fetch/types';
import { BigNumber } from 'ethers';

export type URIGenerator = (request: SourceListRequest) => string;
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

  getQuotes(request: SourceListRequest): Promise<QuoteResponse | FailedQuote>[] {
    return request.sourceIds.map((sourceId) => this.getAllQuotes({ ...request, sourceIds: [sourceId] }).then((quotes) => quotes[0]));
  }

  async getAllQuotes(request: SourceListRequest): Promise<(QuoteResponse | FailedQuote)[]> {
    const url = this.getUrl(request);
    // We reduce 0.5 seconds because calling the API might have this overhead in slow connections
    const response = await this.fetchService.fetch(url, { timeout: reduceTimeout(request.quoteTimeout, '0.5s') });
    return response.json();
  }

  private getUrl({ order, sourceIds, ...request }: SourceListRequest) {
    const record: Record<string, string> = {};
    for (const [key, value] of Object.entries(request)) {
      if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
        record[key] = `${value}`;
      }
    }
    record.includeSources = sourceIds.join(',');
    if (order.type === 'sell') {
      record.sellAmount = BigNumber.from(order.sellAmount).toString();
    } else {
      record.buyAmount = BigNumber.from(order.buyAmount).toString();
    }
    const params = new URLSearchParams(record).toString();
    const uri = this.baseUri({ order, sourceIds, ...request });
    return `${uri}?${params}`;
  }
}
