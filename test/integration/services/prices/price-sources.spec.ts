import ms from 'ms';
import { expect } from 'chai';
import crossFetch from 'cross-fetch';
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
import { IPriceSource, TokenPrice } from '@services/prices/types';
import { PrioritizedPriceSource } from '@services/prices/price-sources/prioritized-price-source';
import { FastestPriceSource } from '@services/prices/price-sources/fastest-price-source';

const TESTS: Record<ChainId, { address: TokenAddress; symbol: string }> = {
  [Chains.OPTIMISM.chainId]: { address: '0xda10009cbd5d07dd0cecc66161fc93d7c9000da1', symbol: 'DAI' },
  [Chains.POLYGON.chainId]: { address: '0x2791bca1f2de4661ed88a30c99a7a9449aa84174', symbol: 'USDC' },
  [Chains.ARBITRUM.chainId]: { address: '0xfc5A1A6EB076a2C7aD06eD22C90d7E710E35ad0a', symbol: 'GMX' },
  [Chains.BNB_CHAIN.chainId]: { address: '0x0e09fabb73bd3ade0a17ecc321fd13a19e81ce82', symbol: 'Cake' },
  [Chains.ETHEREUM.chainId]: { address: '0x2260fac5e5542a773aa44fbcfedf7c193bc2c599', symbol: 'WBTC' },
};

const FETCH_SERVICE = new FetchService(crossFetch);
const DEFI_LLAMA_PRICE_SOURCE = new DefiLlamaPriceSource(FETCH_SERVICE);
const PORTALS_FI_PRICE_SOURCE = new PortalsFiPriceSource(FETCH_SERVICE);
const ODOS_PRICE_SOURCE = new OdosPriceSource(FETCH_SERVICE);
const CACHED_PRICE_SOURCE = new CachedPriceSource(DEFI_LLAMA_PRICE_SOURCE, {
  useCachedValue: 'always',
  useCachedValueIfCalculationFailed: 'always',
});
const PRIORITIZED_PRICE_SOURCE = new PrioritizedPriceSource([PORTALS_FI_PRICE_SOURCE, DEFI_LLAMA_PRICE_SOURCE]);
const FASTEST_PRICE_SOURCE = new FastestPriceSource([PORTALS_FI_PRICE_SOURCE, DEFI_LLAMA_PRICE_SOURCE]);
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
  // priceSourceTest({ title: 'Moralis Source', source: MORALIS_PRICE_SOURCE }); // Commented out because we need API key
  // priceSourceTest({ title: 'Coingecko Source', source: COINGECKO_TOKEN_SOURCE }); Commented out because of rate limiting issues

  function priceSourceTest({ title, source }: { title: string; source: IPriceSource }) {
    describe(title, () => {
      describe('getCurrentPrices', () => {
        let input: Record<ChainId, TokenAddress[]>;
        let result: Record<ChainId, Record<TokenAddress, TokenPrice>>;
        beforeAll(async () => {
          const chains = source.supportedChains();
          const entries = chains.map<[ChainId, TokenAddress[]]>((chainId) => {
            const addresses: TokenAddress[] = [Addresses.NATIVE_TOKEN];
            if (chainId in TESTS) addresses.push(TESTS[chainId].address);
            return [chainId, addresses];
          });
          input = Object.fromEntries(entries);
          result = await source.getCurrentPrices({ addresses: input, config: { timeout: '10s' } });
        });

        test(`Returned amount of chains is as expected`, () => {
          expect(Object.keys(result)).to.have.lengthOf(source.supportedChains().length);
        });

        for (const chainId of source.supportedChains()) {
          const chain = getChainByKey(chainId);
          describe(chain?.name ?? `Chain with id ${chainId}`, () => {
            test(`Returned amount of prices is as expected`, () => {
              expect(Object.keys(result[chainId])).to.have.lengthOf(input[chainId].length);
            });
            test(chain?.nativeCurrency?.symbol ?? 'Native token', () => {
              validateToken({ chainId, address: Addresses.NATIVE_TOKEN });
            });
            if (chainId in TESTS) {
              test(`${TESTS[chainId].symbol}`, () => {
                validateToken({ chainId, ...TESTS[chainId] });
              });
            }
          });
        }

        function validateToken({ chainId, address }: { chainId: ChainId; address: TokenAddress }) {
          const price = result[chainId][address];
          expect(typeof price).to.equal('number');
        }
      });
    });
  }
});
