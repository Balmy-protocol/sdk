import chai, { expect } from 'chai';
import chaiAsPromised from 'chai-as-promised';
import { given, then, when } from '@test-utils/bdd';
import { ChainId, TokenAddress } from '@types';
import { AggregatorPriceSource, PriceAggregationMethod } from '@services/prices/price-sources/aggregator-price-source';
import { IPriceSource, PriceResult, TokenPrice } from '@services/prices';
chai.use(chaiAsPromised);

const TOKEN_A = '0x0000000000000000000000000000000000000001';
const TOKEN_B = '0x0000000000000000000000000000000000000002';
const TOKEN_C = '0x0000000000000000000000000000000000000003';

describe('Aggregator Price Source', () => {
  when('source is created empty', () => {
    then('aggregator source fails', () => {
      expect(() => new AggregatorPriceSource([], 'median')).to.throw('No sources were specified');
    });
  });

  when('one of the given chains is not supported by any source', () => {
    then('aggregator source fails', async () => {
      const source1 = buildSource({}, 1);
      const source2 = buildSource({}, 1);
      const aggregator = new AggregatorPriceSource([source1, source2], 'median');

      const promise = aggregator.getCurrentPrices({ addresses: { [2]: [TOKEN_A] } });
      await expect(promise).to.to.eventually.be.rejectedWith(`Current price sources can't support all the given chains`);
    });
  });

  when('there is only one source that works', () => {
    then('that result is returned', async () => {
      const prices = { [TOKEN_A]: { price: 10, closestTimestamp: 20 } };
      const aggregator = new AggregatorPriceSource([buildSource(prices, 1), buildSourceThatFails(1)], 'median');
      const result = await aggregator.getCurrentPrices({ addresses: { [1]: [TOKEN_A] } });
      expect(result).to.deep.equal({ [1]: prices });
    });
  });

  when('all sources fail', () => {
    then('an empty result is returned', async () => {
      const source1 = buildSourceThatFails(1);
      const source2 = buildSourceThatFails(1);
      const aggregator = new AggregatorPriceSource([source1, source2], 'median');

      const result = await aggregator.getCurrentPrices({ addresses: { [1]: [TOKEN_A] } });
      expect(result).to.deep.equal({});
    });
  });

  describe('Aggregation', () => {
    aggregationTest({
      method: 'max',
      prices: [{ [TOKEN_A]: 10, [TOKEN_B]: 20 }, { [TOKEN_A]: 20, [TOKEN_B]: 10 }, { [TOKEN_C]: 40 }],
      expected: { [TOKEN_A]: 20, [TOKEN_B]: 20, [TOKEN_C]: 40 },
    });

    aggregationTest({
      method: 'min',
      prices: [{ [TOKEN_A]: 10, [TOKEN_B]: 20 }, { [TOKEN_A]: 20, [TOKEN_B]: 5 }, { [TOKEN_C]: 40 }],
      expected: { [TOKEN_A]: 10, [TOKEN_B]: 5, [TOKEN_C]: 40 },
    });

    aggregationTest({
      method: 'avg',
      prices: [
        { [TOKEN_A]: 10, [TOKEN_B]: 20 },
        { [TOKEN_A]: 20, [TOKEN_B]: 22 },
        { [TOKEN_C]: 40, [TOKEN_B]: 30 },
      ],
      expected: { [TOKEN_A]: 15, [TOKEN_B]: 24, [TOKEN_C]: 40 },
    });

    aggregationTest({
      method: 'median',
      prices: [
        { [TOKEN_A]: 10, [TOKEN_B]: 20 },
        { [TOKEN_A]: 20, [TOKEN_B]: 22 },
        { [TOKEN_C]: 40, [TOKEN_B]: 30 },
      ],
      expected: { [TOKEN_A]: 15, [TOKEN_B]: 22, [TOKEN_C]: 40 },
    });
  });

  function aggregationTest({
    prices,
    expected,
    method,
  }: {
    prices: Record<TokenAddress, TokenPrice>[];
    expected: Record<TokenAddress, TokenPrice>;
    method: PriceAggregationMethod;
  }) {
    when(`aggregating by ${method}`, () => {
      let result: Record<TokenAddress, PriceResult>;
      given(async () => {
        const sources = prices.map((price) => buildSource(addTimestamp(price)));
        const allTokens = [...new Set(prices.flatMap((prices) => Object.keys(prices)))];
        const aggSource = new AggregatorPriceSource(sources, method);
        result = await aggSource.getCurrentPrices({ addresses: { [1]: allTokens } }).then((result) => result[1]);
      });

      then('result is as expected', () => {
        expect(result).to.deep.equal(addTimestamp(expected));
      });
    });
  }

  function buildSource(prices: Record<TokenAddress, PriceResult>, chainId: ChainId = 1): IPriceSource {
    return {
      getBulkHistoricalPrices: () => Promise.reject('Not supported'),
      getHistoricalPrices: () => Promise.reject('Not supported'),
      supportedQueries: () => ({ [chainId]: { getHistoricalPrices: false, getCurrentPrices: true, getBulkHistoricalPrices: false } }),
      getCurrentPrices: () => Promise.resolve({ [chainId]: prices }),
    };
  }

  function buildSourceThatFails(...onChain: ChainId[]): IPriceSource {
    return {
      getBulkHistoricalPrices: () => Promise.reject('Not supported'),
      getHistoricalPrices: () => Promise.reject('Not supported'),
      supportedQueries: () =>
        Object.fromEntries(
          onChain.map((chainId) => [chainId, { getHistoricalPrices: false, getCurrentPrices: true, getBulkHistoricalPrices: false }])
        ),
      getCurrentPrices: () => Promise.reject(new Error('Something failed')),
    };
  }

  function addTimestamp(prices: Record<TokenAddress, TokenPrice>): Record<TokenAddress, PriceResult> {
    return Object.fromEntries(Object.entries(prices).map(([token, price]) => [token, { price, closestTimestamp: price }]));
  }
});
