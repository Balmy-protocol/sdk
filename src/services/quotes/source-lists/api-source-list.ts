import { reduceTimeout } from '@shared/timeouts';
import { SourceId, SourceMetadata } from '../types';
import { IQuoteSourceList, SourceListRequest, SourceListResponse } from './types';
import { IFetchService } from '@services/fetch/types';
import { BigNumber } from 'ethers';
import queryString from 'query-string-esm';
import { PartialOnly } from '@utility-types';

export type APISourceListRequest = PartialOnly<SourceListRequest, 'external'>;
export type URIGenerator = (request: APISourceListRequest) => string;
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

  async getQuote(request: APISourceListRequest): Promise<SourceListResponse> {
    // We reduce 0.75 seconds because calling the API might have this overhead in slow connections
    const reducedTimeout = reduceTimeout(request.quoteTimeout, '0.75s');
    const url = this.getUrl({ ...request, quoteTimeout: reducedTimeout });
    const response = await this.fetchService.fetch(url, { timeout: request.quoteTimeout });
    return response.json();
  }

  private getUrl({ external, order, ...request }: APISourceListRequest) {
    const requestToParse: any = request;
    if (order.type === 'sell') {
      requestToParse.sellAmount = BigNumber.from(order.sellAmount).toString();
    } else {
      requestToParse.buyAmount = BigNumber.from(order.buyAmount).toString();
    }

    const params = queryString.stringify(requestToParse, { arrayFormat: 'comma', skipEmptyString: true, skipNull: true });
    const uri = this.baseUri({ order, ...request });
    return uri.includes('?') ? uri + '&' + params : uri + '?' + params;
  }
}
