import chai, { expect } from 'chai';
import { then, when } from '@test-utils/bdd';
import { GasSpeed, IGasService, IQuickGasCostCalculator, DefaultGasValues } from '@services/gas/types';
import { BigIntish, ChainId, TokenAddress, InputTransaction } from '@types';
import { QuoteService } from '@services/quotes/quote-service';
import { IQuoteSourceList, QuoteRequest, QuoteTransaction } from '@services/quotes';
import { IPriceService } from '@services/prices';
import { IMetadataService } from '@services/metadata';
import { BaseTokenMetadata } from '@services/metadata/types';
import { CHANGELLY_METADATA } from '@services/quotes/quote-sources/changelly-quote-source';
import { SourceListQuoteResponse } from '@services/quotes/source-lists/types';
import chaiAsPromised from 'chai-as-promised';
chai.use(chaiAsPromised);

describe('Quote Service', () => {
  when('request fails', () => {
    then('it is returned as a failed quote', async () => {
      const sourceList = new QuoteService({
        sourceList: FAILING_SOURCE_LIST,
        metadataService: METADATA_SERVICE,
        priceService: PRICE_SERVICE,
        gasService: GAS_SERVICE,
        defaultConfig: undefined,
      });
      const quotes = sourceList.getQuotes(REQUEST);
      expect(Object.keys(quotes)).to.have.lengthOf(1);
      await expect(quotes.source).to.have.rejectedWith('Something failed at list level');
    });
  });
  when('request works but gas request fails', () => {
    then('it is returned as a failed quote', async () => {
      const sourceList = new QuoteService({
        sourceList: SOURCE_LIST,
        gasService: FAILING_GAS_SERVICE,
        metadataService: METADATA_SERVICE,
        priceService: PRICE_SERVICE,
        defaultConfig: undefined,
      });
      const quotes = sourceList.getQuotes(REQUEST);
      expect(Object.keys(quotes)).to.have.lengthOf(1);
      await expect(quotes.source).to.have.rejectedWith('Failed to fetch gas data');
    });
  });
  when('request works but metadata request fails', () => {
    then('it is returned as a failed quote', async () => {
      const sourceList = new QuoteService({
        sourceList: SOURCE_LIST,
        gasService: GAS_SERVICE,
        metadataService: FAILING_METADATA_SERVICE,
        priceService: PRICE_SERVICE,
        defaultConfig: undefined,
      });
      const quotes = sourceList.getQuotes(REQUEST);
      expect(Object.keys(quotes)).to.have.lengthOf(1);
      await expect(quotes.source).to.have.rejectedWith(`Failed to fetch the quote's tokens`);
    });
  });
  when('request works but price request fails', () => {
    then('response is returned correctly', async () => {
      const sourceList = new QuoteService({
        sourceList: SOURCE_LIST,
        gasService: GAS_SERVICE,
        metadataService: METADATA_SERVICE,
        priceService: FAILING_PRICE_SERVICE,
        defaultConfig: undefined,
      });
      const quotes = sourceList.getQuotes(REQUEST);
      expect(Object.keys(quotes)).to.have.lengthOf(1);
      expect(await quotes.source).to.not.have.any.keys('error');
    });
  });
});

const SOURCE = 'source';

const RESPONSE: SourceListQuoteResponse = {
  sellAmount: 1000n,
  buyAmount: 1234n,
  maxSellAmount: 1000n,
  minBuyAmount: 1000n,
  estimatedGas: 12345n,
  type: 'sell',
  recipient: '0x0000000000000000000000000000000000000004',
  source: { id: SOURCE, allowanceTarget: '0x0000000000000000000000000000000000000005', name: 'Name', logoURI: 'logo' },
  customData: {
    tx: {
      from: '0x0000000000000000000000000000000000000005',
      to: '0x0000000000000000000000000000000000000006',
      data: '',
    },
  },
};

const REQUEST: { request: QuoteRequest } = {
  request: {
    chainId: 1,
    sellToken: '0x0000000000000000000000000000000000000001',
    buyToken: '0x0000000000000000000000000000000000000002',
    order: { type: 'sell', sellAmount: 100 },
    slippagePercentage: 0.03,
    takerAddress: '0x0000000000000000000000000000000000000003',
  },
};

const SOURCE_LIST: IQuoteSourceList = {
  supportedSources: () => ({ [SOURCE]: CHANGELLY_METADATA }),
  getQuotes: () => ({ [SOURCE]: Promise.resolve(RESPONSE) }),
  buildTxs: () => {
    throw new Error('Function not implemented.');
  },
};
const FAILING_SOURCE_LIST: IQuoteSourceList = {
  ...SOURCE_LIST,
  getQuotes: () => ({ [SOURCE]: Promise.reject(new Error('Something failed at list level')) }),
};

const METADATA_SERVICE: IMetadataService<BaseTokenMetadata> = {
  supportedChains: () => [1],
  supportedProperties: () => ({ [1]: { symbol: 'present', decimals: 'present' } }),
  getMetadata: () => Promise.reject(new Error('Should not be called')),
  getMetadataInChain: ({ chainId, tokens }: { chainId: ChainId; tokens: TokenAddress[] }) =>
    Promise.resolve(Object.fromEntries(tokens.map((address) => [address, { symbol: 'SYM', decimals: 18 }]))) as any,
};
const FAILING_METADATA_SERVICE: IMetadataService<BaseTokenMetadata> = {
  ...METADATA_SERVICE,
  getMetadataInChain: ({ chainId, tokens }: { chainId: ChainId; tokens: TokenAddress[] }) => Promise.reject(new Error('Failed')),
};

const PRICE_SERVICE: IPriceService = {
  supportedChains: () => [1],
  supportedQueries: () => ({ [1]: { getCurrentPrices: true, getHistoricalPrices: true, getBulkHistoricalPrices: false, getChart: false } }),
  getCurrentPrices: () => Promise.reject(new Error('Should not be called')),
  getCurrentPricesInChain: ({ tokens }) =>
    Promise.resolve(Object.fromEntries(tokens.map((address, i) => [address, { price: i * 10, closestTimestamp: 0 }]))),
  getHistoricalPrices: () => Promise.reject(new Error('Should not be called')),
  getHistoricalPricesInChain: () => Promise.reject(new Error('Should not be called')),
  getBulkHistoricalPrices: () => Promise.reject(new Error('Should not be called')),
  getChart: () => Promise.reject(new Error('Should not be called')),
};
const FAILING_PRICE_SERVICE: IPriceService = {
  ...PRICE_SERVICE,
  getCurrentPricesInChain: () => Promise.reject(new Error('Failed')),
};

const GAS_CALCULATOR: IQuickGasCostCalculator<DefaultGasValues> = {
  supportedSpeeds: () => ({ standard: 'present', fast: 'optional', instant: 'optional' } as any),
  calculateGasCost: (_: { gasEstimation: BigIntish; tx?: InputTransaction }) =>
    ({ standard: { maxFeePerGas: 10n, maxPriorityFeePerGas: 10n, gasCostNativeToken: 10n } } as any),
  getGasPrice: () => ({ standard: { maxFeePerGas: 10n, maxPriorityFeePerGas: 10n } } as any),
};
const GAS_SERVICE: IGasService<DefaultGasValues> = {
  supportedSpeeds: () => ({}),
  supportedChains: () => [1],
  estimateGas: (_: { chainId: ChainId; tx: InputTransaction }) => Promise.reject(new Error('Should not be called')),
  getGasPrice: (_: { chainId: ChainId; options?: { speed?: GasSpeed } }) => Promise.reject(new Error('Should not be called')),
  calculateGasCost: (_: { chainId: ChainId; gasEstimation: BigIntish; tx?: InputTransaction; options?: { speed?: GasSpeed } }) =>
    Promise.reject(new Error('Should not be called')),
  getQuickGasCalculator: (_: { chainId: ChainId }) => Promise.resolve(GAS_CALCULATOR) as any,
};
const FAILING_GAS_SERVICE: IGasService<DefaultGasValues> = {
  ...GAS_SERVICE,
  getQuickGasCalculator: (_: { chainId: ChainId }) => Promise.reject(new Error('Failed')),
};
