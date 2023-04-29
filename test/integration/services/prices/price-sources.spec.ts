import ms from 'ms';
import chai, { expect } from 'chai';
import chaiAsPromised from 'chai-as-promised';
import { DefiLlamaPriceSource } from '@services/prices/price-sources/defi-llama-price-source';
import { PortalsFiPriceSource } from '@services/prices/price-sources/portals-fi-price-source';
import { OdosPriceSource } from '@services/prices/price-sources/odos-price-source';
import { CoingeckoPriceSource } from '@services/prices/price-sources/coingecko-price-source';
import { MoralisPriceSource } from '@services/prices/price-sources/moralis-price-source';
import { CachedPriceSource } from '@services/prices/price-sources/cached-price-source';
import { FetchService } from '@services/fetch/fetch-service';
import { Chains, getChainByKey } from '@chains';
import { Addresses } from '@shared/constants';
import { ChainId, TokenAddress } from '@types';
import { IPriceSource, PricesQueriesSupport } from '@services/prices/types';
import { PrioritizedPriceSource } from '@services/prices/price-sources/prioritized-price-source';
import { FastestPriceSource } from '@services/prices/price-sources/fastest-price-source';
import { AggregatorPriceSource } from '@services/prices/price-sources/aggregator-price-source';
import { MeanFinancePriceSource } from '@services/prices/price-sources/mean-finance-price-source';
chai.use(chaiAsPromised);

const TESTS: Record<ChainId, { address: TokenAddress; symbol: string }> = {
  [Chains.OPTIMISM.chainId]: { address: '0xda10009cbd5d07dd0cecc66161fc93d7c9000da1', symbol: 'DAI' },
  [Chains.POLYGON.chainId]: { address: '0x2791bca1f2de4661ed88a30c99a7a9449aa84174', symbol: 'USDC' },
  [Chains.ARBITRUM.chainId]: { address: '0xfc5A1A6EB076a2C7aD06eD22C90d7E710E35ad0a', symbol: 'GMX' },
  [Chains.BNB_CHAIN.chainId]: { address: '0x0e09fabb73bd3ade0a17ecc321fd13a19e81ce82', symbol: 'Cake' },
  [Chains.ETHEREUM.chainId]: { address: '0x2260fac5e5542a773aa44fbcfedf7c193bc2c599', symbol: 'WBTC' },
};

const FETCH_SERVICE = new FetchService();
const DEFI_LLAMA_PRICE_SOURCE = new DefiLlamaPriceSource(FETCH_SERVICE);
const PORTALS_FI_PRICE_SOURCE = new PortalsFiPriceSource(FETCH_SERVICE);
const ODOS_PRICE_SOURCE = new OdosPriceSource(FETCH_SERVICE);
const CACHED_PRICE_SOURCE = new CachedPriceSource(DEFI_LLAMA_PRICE_SOURCE, {
  expiration: {
    useCachedValue: 'always',
    useCachedValueIfCalculationFailed: 'always',
  },
  maxSize: 100,
});
const PRIORITIZED_PRICE_SOURCE = new PrioritizedPriceSource([PORTALS_FI_PRICE_SOURCE, DEFI_LLAMA_PRICE_SOURCE]);
const FASTEST_PRICE_SOURCE = new FastestPriceSource([PORTALS_FI_PRICE_SOURCE, DEFI_LLAMA_PRICE_SOURCE]);
const AGGREGATOR_PRICE_SOURCE = new AggregatorPriceSource([ODOS_PRICE_SOURCE, DEFI_LLAMA_PRICE_SOURCE], 'median');
const MEAN_PRICE_SOURCE = new MeanFinancePriceSource(FETCH_SERVICE);
const MORALIS_PRICE_SOURCE = new MoralisPriceSource(FETCH_SERVICE, 'API_KEY');
const COINGECKO_TOKEN_SOURCE = new CoingeckoPriceSource(FETCH_SERVICE);

jest.retryTimes(2);
jest.setTimeout(ms('1m'));

describe('Token Price Sources', () => {
  priceSourceTest({ title: 'Defi Llama Source', source: DEFI_LLAMA_PRICE_SOURCE });
  priceSourceTest({ title: 'Portals Fi Source', source: PORTALS_FI_PRICE_SOURCE });
  priceSourceTest({ title: 'Odos Source', source: ODOS_PRICE_SOURCE });
  priceSourceTest({ title: 'Cached Price Source', source: CACHED_PRICE_SOURCE });
  priceSourceTest({ title: 'Prioritized Source', source: PRIORITIZED_PRICE_SOURCE });
  priceSourceTest({ title: 'Fastest Source', source: FASTEST_PRICE_SOURCE });
  priceSourceTest({ title: 'Aggregator Source', source: AGGREGATOR_PRICE_SOURCE });
  priceSourceTest({ title: 'Mean Finance', source: MEAN_PRICE_SOURCE });
  // priceSourceTest({ title: 'Moralis Source', source: MORALIS_PRICE_SOURCE }); // Commented out because we need API key
  // priceSourceTest({ title: 'Coingecko Source', source: COINGECKO_TOKEN_SOURCE }); Commented out because of rate limiting issues

  function priceSourceTest({ title, source }: { title: string; source: IPriceSource }) {
    describe(title, () => {
      queryTest({
        source,
        query: 'getCurrentPrices',
        getResult: (source, addresses) =>
          source.getCurrentPrices({
            addresses,
            config: { timeout: '10s' },
          }),
        validation: (price) => {
          expect(typeof price).to.equal('number');
        },
      });
      queryTest({
        source,
        query: 'getHistoricalPrices',
        getResult: (source, addresses) =>
          source.getHistoricalPrices({
            addresses,
            timestamp: 1680220800, // Friday, 31 March 2023 0:00:00
            config: { timeout: '10s' },
          }),
        validation: ({ price, timestamp }) => {
          expect(typeof price).to.equal('number');
          expect(typeof timestamp).to.equal('number');
        },
      });
    });
  }

  function queryTest<T>({
    source,
    query,
    getResult,
    validation: validate,
  }: {
    source: IPriceSource;
    getResult: (source: IPriceSource, input: Record<ChainId, TokenAddress[]>) => Promise<Record<ChainId, Record<TokenAddress, T>>>;
    query: keyof PricesQueriesSupport;
    validation: (value: T) => void;
  }) {
    describe(query, () => {
      const { supported, notSupported } = calculateChainSupport(source, query);
      if (supported.length > 0) {
        const addresses = getAddressesForChains(supported);
        describe('Supported chains', () => {
          let result: Record<ChainId, Record<TokenAddress, T>>;
          beforeAll(async () => {
            result = await getResult(source, addresses);
          });

          test(`Returned amount of chains is as expected`, () => {
            expect(Object.keys(result)).to.have.lengthOf(supported.length);
          });

          for (const chainId of supported) {
            const chain = getChainByKey(chainId);
            describe(chain?.name ?? `Chain with id ${chainId}`, () => {
              test(`Returned amount of prices is as expected`, () => {
                expect(Object.keys(result[chainId])).to.have.lengthOf(addresses[chainId].length);
              });
              test(chain?.nativeCurrency?.symbol ?? 'Native token', () => {
                validate(result[chainId][Addresses.NATIVE_TOKEN]);
              });
              if (chainId in TESTS) {
                test(`${TESTS[chainId].symbol}`, () => {
                  validate(result[chainId][TESTS[chainId].address]);
                });
              }
            });
          }
        });
      }
      if (notSupported.length > 0) {
        describe('Unsupported chains', () => {
          for (const chainId of notSupported) {
            const chain = getChainByKey(chainId);
            test(`${chain?.name ?? `Chain with id ${chainId}`} fails as it's not supported`, async () => {
              const promise = getResult(source, { [chainId]: [] });
              await expect(promise).to.eventually.be.rejectedWith('Operation not supported');
            });
          }
        });
      }
    });
  }

  function calculateChainSupport(source: IPriceSource, query: keyof PricesQueriesSupport) {
    const support = source.supportedQueries();
    const allChains = Object.entries(support).map(([chainId, support]) => ({ chainId: Number(chainId), supported: support[query] }));
    const supported = allChains.filter(({ supported }) => supported).map(({ chainId }) => chainId);
    const notSupported = allChains.filter(({ supported }) => !supported).map(({ chainId }) => chainId);
    return { supported, notSupported };
  }

  function getAddressesForChains(chainIds: ChainId[]) {
    return Object.fromEntries(
      chainIds.map<[ChainId, TokenAddress[]]>((chainId) => {
        const addresses: TokenAddress[] = [Addresses.NATIVE_TOKEN];
        if (chainId in TESTS) addresses.push(TESTS[chainId].address);
        return [chainId, addresses];
      })
    );
  }
});
