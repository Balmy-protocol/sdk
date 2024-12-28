import chai, { expect } from 'chai';
import chaiAsPromised from 'chai-as-promised';
import { LocalSourceList } from '@services/quotes/source-lists/local-source-list';
import { SourceListQuoteRequest } from '@services/quotes/source-lists/types';
import { then, when } from '@test-utils/bdd';
import { IProviderService } from '@services/providers';
import { IFetchService } from '@services/fetch';
chai.use(chaiAsPromised);

describe('Local Source List', () => {
  describe('Rejected Promises', () => {
    when('asking for unknown source', () => {
      then('promise is rejected', async () => {
        const sourceList = new LocalSourceList({
          providerService: PROVIDER_SERVICE,
          fetchService: FETCH_SERVICE,
        });
        const quotes = sourceList.getQuotes({
          ...REQUEST,
          sources: ['unknown'],
          order: { type: 'sell', sellAmount: 100 },
        });
        expect(Object.keys(quotes)).to.have.lengthOf(1);
        await expect(quotes['unknown']).to.have.rejectedWith(`Could not find a source with id 'unknown'`);
      });
    });

    when('executing a buy order for a source that does not support it', () => {
      then('promise is rejected', async () => {
        const sourceList = new LocalSourceList({
          providerService: PROVIDER_SERVICE,
          fetchService: FETCH_SERVICE,
        });
        const quotes = sourceList.getQuotes({
          ...REQUEST,
          order: { type: 'buy', buyAmount: 100 },
          sources: ['odos'],
        });
        expect(Object.keys(quotes)).to.have.lengthOf(1);
        await expect(quotes['odos']).to.have.rejectedWith(`Source with id 'odos' does not support buy orders`);
      });
    });

    when('context/config is invalid for a source', () => {
      then('promise is rejected', async () => {
        const sourceList = new LocalSourceList({
          providerService: PROVIDER_SERVICE,
          fetchService: FETCH_SERVICE,
        });
        const quotes = sourceList.getQuotes({
          ...REQUEST,
          order: { type: 'sell', sellAmount: 100 },
          sources: ['enso'],
        });
        expect(Object.keys(quotes)).to.have.lengthOf(1);
        await expect(quotes['enso']).to.have.rejectedWith(`The current context or config is not valid for source with id 'enso'`);
      });
    });
  });
});

const REQUEST: Omit<SourceListQuoteRequest, 'sources' | 'order'> = {
  chainId: 1,
  sellToken: '0x0000000000000000000000000000000000000001',
  buyToken: '0x0000000000000000000000000000000000000002',
  slippagePercentage: 0.03,
  takerAddress: '0x0000000000000000000000000000000000000003',
  external: {
    tokenData: {} as any,
    gasPrice: {} as any,
  },
};

const PROVIDER_SERVICE: IProviderService = {} as any;
const FETCH_SERVICE: IFetchService = {} as any;
