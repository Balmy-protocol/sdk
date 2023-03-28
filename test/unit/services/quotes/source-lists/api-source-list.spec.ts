import { expect } from 'chai';
import { APISourceList, APISourceListRequest } from '@services/quotes/source-lists/api-source-list';
import { SourceId, SourceMetadata } from '@services/quotes/types';
import { ZRX_METADATA } from '@services/quotes/quote-sources/0x';
import { given, then, when } from '@test-utils/bdd';
import { IFetchService, RequestInit } from '@services/fetch';

const SOURCES: Record<SourceId, SourceMetadata> = { sourceId: ZRX_METADATA };
const BASE_URI = 'http://baseUri';

describe('API Source List', () => {
  urlTest({
    when: 'when setting one source',
    request: {
      chainId: 1,
      sellToken: 'sellToken',
      buyToken: 'buyToken',
      order: { type: 'buy', buyAmount: 1000 },
      slippagePercentage: 1,
      takerAddress: 'takerAddress',
      sourceId: 'source',
    },
    expected:
      BASE_URI +
      '?buyAmount=1000' +
      '&buyToken=buyToken' +
      '&chainId=1' +
      '&sellToken=sellToken' +
      '&slippagePercentage=1' +
      '&sourceId=source' +
      '&takerAddress=takerAddress',
  });

  urlTest({
    when: 'when setting a quote timeout',
    request: {
      chainId: 1,
      sellToken: 'sellToken',
      buyToken: 'buyToken',
      order: { type: 'sell', sellAmount: 1000 },
      slippagePercentage: 1,
      takerAddress: 'takerAddress',
      quoteTimeout: '5m',
      estimateBuyOrdersWithSellOnlySources: true,
      sourceId: 'source',
    },
    expected:
      BASE_URI +
      '?buyToken=buyToken' +
      '&chainId=1' +
      '&estimateBuyOrdersWithSellOnlySources=true' +
      '&quoteTimeout=299900' +
      '&sellAmount=1000' +
      '&sellToken=sellToken' +
      '&slippagePercentage=1' +
      '&sourceId=source' +
      '&takerAddress=takerAddress',
  });

  function urlTest({ when: title, request, expected }: { when: string; request: APISourceListRequest; expected: string }) {
    when(title, () => {
      let fetchService: FetchService;
      given(async () => {
        fetchService = new FetchService();
        const sourceList = new APISourceList({ fetchService, baseUri: () => BASE_URI, sources: SOURCES });
        await sourceList.getQuote(request);
      });
      then('url is as expected', () => {
        expect(fetchService.urls).to.have.lengthOf(1);
        expect(fetchService.urls[0]).to.equal(expected);
      });
    });
  }
});

class FetchService implements IFetchService {
  public urls: string[] = [];

  fetch(input: RequestInfo | URL, init?: RequestInit | undefined): Promise<Response> {
    if (typeof input !== 'string') throw new Error('WTF?');
    this.urls.push(input);
    return { json: () => Promise.resolve() } as any;
  }
}
