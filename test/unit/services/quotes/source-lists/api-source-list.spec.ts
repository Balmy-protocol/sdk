import { getChainByKey } from '@chains';
import { expect } from 'chai';
import { buildSources, DefaultSourcesConfig } from '@services/quotes/source-registry';
import { APISourceList } from '@services/quotes/source-lists/api-source-list';
import { SourceId, SourceMetadata } from '@services/quotes/types';
import { ZRX_METADATA } from '@services/quotes/quote-sources/0x';
import { given, then, when } from '@test-utils/bdd';
import { IFetchService, RequestInit } from '@services/fetch';
import { SourceListRequest } from '@services/quotes/source-lists/types';

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
      sourceIds: ['source'],
    },
    expected:
      BASE_URI +
      '?buyAmount=1000' +
      '&buyToken=buyToken' +
      '&chainId=1' +
      '&sellToken=sellToken' +
      '&slippagePercentage=1' +
      '&sourceIds=source' +
      '&takerAddress=takerAddress',
  });

  urlTest({
    when: 'when setting two sources',
    request: {
      chainId: 1,
      sellToken: 'sellToken',
      buyToken: 'buyToken',
      order: { type: 'sell', sellAmount: 1000 },
      slippagePercentage: 1,
      takerAddress: 'takerAddress',
      quoteTimeout: '10m',
      estimateBuyOrdersWithSellOnlySources: true,
      sourceIds: ['source1', 'source2'],
    },
    expected:
      BASE_URI +
      '?buyToken=buyToken' +
      '&chainId=1' +
      '&estimateBuyOrdersWithSellOnlySources=true' +
      '&quoteTimeout=10m' +
      '&sellAmount=1000' +
      '&sellToken=sellToken' +
      '&slippagePercentage=1' +
      '&sourceIds=source1,source2' +
      '&takerAddress=takerAddress',
  });

  function urlTest({ when: title, request, expected }: { when: string; request: SourceListRequest; expected: string }) {
    when(title, () => {
      let fetchService: FetchService;
      given(() => {
        fetchService = new FetchService();
        const sourceList = new APISourceList({ fetchService, baseUri: () => BASE_URI, sources: SOURCES });
        sourceList.getAllQuotes(request);
      });
      then('url is as expected', () => {
        expect(fetchService.url).to.equal(expected);
      });
    });
  }
});

class FetchService implements IFetchService {
  public url: string = '';

  fetch(input: RequestInfo | URL, init?: RequestInit | undefined): Promise<Response> {
    if (typeof input !== 'string') throw new Error('WTF?');
    this.url = input;
    return { json: () => Promise.resolve() } as any;
  }
}
