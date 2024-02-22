import ms from 'ms';
import chai, { expect } from 'chai';
import { ProviderService } from '@services/providers/provider-service';
import { MulticallService } from '@services/multicall/multicall-service';
import { PublicRPCsSource } from '@services/providers/provider-sources/public-providers';
import { RPCBalanceSource } from '@services/balances/balance-sources/rpc-balance-source';
import { AlchemyBalanceSource } from '@services/balances/balance-sources/alchemy-balance-source';
import { CachedBalanceSource } from '@services/balances/balance-sources/cached-balance-source';
import { OneInchBalanceSource } from '@services/balances/balance-sources/1inch-balance-source';
import { MagpieBalanceSource } from '@services/balances/balance-sources/magpie-balance-source';
import { FastestBalanceSource } from '@services/balances/balance-sources/fastest-balance-source';
import { Chains, getChainByKey } from '@chains';
import { Addresses } from '@shared/constants';
import { Address, AmountOfToken, ChainId, TokenAddress } from '@types';
import { IBalanceSource } from '@services/balances/types';
import chaiAsPromised from 'chai-as-promised';
import dotenv from 'dotenv';
import { FetchService } from '@services/fetch/fetch-service';
import { CHAINS_WITH_KNOWN_ISSUES } from '@test-utils/other';
import { formatUnits, parseUnits } from 'viem';
dotenv.config();
chai.use(chaiAsPromised);

const TESTS: Record<ChainId, { address: TokenAddress; minAmount: `${number}`; decimals: number; symbol: string }> = {
  [Chains.OPTIMISM.chainId]: {
    address: '0xda10009cbd5d07dd0cecc66161fc93d7c9000da1',
    minAmount: '6.519182750064400737',
    decimals: 18,
    symbol: 'DAI',
  },
  [Chains.POLYGON.chainId]: { address: '0x2791bca1f2de4661ed88a30c99a7a9449aa84174', minAmount: '141.765676', decimals: 6, symbol: 'USDC' },
  [Chains.ARBITRUM.chainId]: {
    address: '0xfc5a1a6eb076a2c7ad06ed22c90d7e710e35ad0a',
    minAmount: '0.000250000000000001',
    decimals: 18,
    symbol: 'GMX',
  },
  [Chains.BNB_CHAIN.chainId]: {
    address: '0x0e09fabb73bd3ade0a17ecc321fd13a19e81ce82',
    minAmount: '715409466.348355459967629155',
    decimals: 18,
    symbol: 'Cake',
  },
  [Chains.ETHEREUM.chainId]: {
    address: '0x0000000000095413afc295d19edeb1ad7b71c952',
    minAmount: '0.000000000000017',
    decimals: 18,
    symbol: 'LON',
  },
};
const CHAINS_WITH_NO_NATIVE_TOKEN_ON_DEAD_ADDRESS: Set<ChainId> = new Set([
  Chains.AURORA.chainId,
  Chains.OASIS_EMERALD.chainId,
  Chains.POLYGON_ZKEVM.chainId,
]);

const DEAD_ADDRESS = '0x000000000000000000000000000000000000dead';

const PROVIDER_SERVICE = new ProviderService(new PublicRPCsSource());
const FETCH_SERVICE = new FetchService();
const RPC_BALANCE_SOURCE = new RPCBalanceSource(PROVIDER_SERVICE, new MulticallService(PROVIDER_SERVICE));
const ALCHEMY_BALANCE_SOURCE = new AlchemyBalanceSource(process.env.ALCHEMY_API_KEY!);
const CACHED_BALANCE_SOURCE = new CachedBalanceSource(RPC_BALANCE_SOURCE, {
  expiration: {
    useCachedValue: 'always',
    useCachedValueIfCalculationFailed: 'always',
  },
  maxSize: 100,
});
const ONE_INCH_BALANCE_SOURCE = new OneInchBalanceSource(FETCH_SERVICE);
const MAGPIE_BALANCE_SOURCE = new MagpieBalanceSource(FETCH_SERVICE);
const FASTEST_BALANCE_SOURCE = new FastestBalanceSource([RPC_BALANCE_SOURCE]);

jest.retryTimes(2);
jest.setTimeout(ms('1m'));

describe('Balance Sources', () => {
  balanceSourceTest({ title: 'RPC Source', source: RPC_BALANCE_SOURCE });
  // balanceSourceTest({ title: 'Alchemy Source', source: ALCHEMY_BALANCE_SOURCE }); Disabled because of flakyness
  balanceSourceTest({ title: 'Cached Source', source: CACHED_BALANCE_SOURCE });
  // balanceSourceTest({ title: '1inch Source', source: ONE_INCH_BALANCE_SOURCE }); Disabled because Cloudlare is acting up and blocking all non-browser requests
  // balanceSourceTest({ title: 'Moralis Source', source: MORALIS_BALANCE_SOURCE }); Note: can't test it properly because of rate limiting and dead address blacklist
  // balanceSourceTest({ title: 'Magpie', source: MAGPIE_BALANCE_SOURCE }); Note: fails to return all tokens since there are so many
  balanceSourceTest({ title: 'Fastest Source', source: FASTEST_BALANCE_SOURCE });

  function balanceSourceTest({ title, source }: { title: string; source: IBalanceSource }) {
    describe(title, () => {
      const sourceSupport = Object.fromEntries(
        Object.entries(source.supportedQueries()).filter(([chainId]) => !CHAINS_WITH_KNOWN_ISSUES.includes(Number(chainId)))
      );

      describe('getBalancesForTokens', () => {
        let result: Record<ChainId, Record<Address, Record<TokenAddress, AmountOfToken>>>;
        beforeAll(async () => {
          const chains = Object.keys(sourceSupport).map(Number);
          const entries = chains.map<[ChainId, Record<Address, TokenAddress[]>]>((chainId) => {
            const addresses: TokenAddress[] = [Addresses.NATIVE_TOKEN];
            if (chainId in TESTS) addresses.push(TESTS[chainId].address);
            return [chainId, { [DEAD_ADDRESS]: addresses }];
          });
          const input = Object.fromEntries(entries);
          result = await source.getBalancesForTokens({ tokens: input, config: { timeout: '30s' } });
        });

        test('getBalancesForTokens is supported', () => {
          for (const { getBalancesForTokens } of Object.values(sourceSupport)) {
            expect(getBalancesForTokens).to.be.true;
          }
        });

        validateBalances(() => result, Object.keys(sourceSupport).map(Number), true);
      });

      describe('getTokensHeldByAccount', () => {
        const supportedChains = Object.entries(sourceSupport)
          .filter(([, support]) => support.getTokensHeldByAccount)
          .map(([chainId]) => Number(chainId));

        if (supportedChains.length > 0) {
          let result: Record<ChainId, Record<Address, Record<TokenAddress, AmountOfToken>>>;
          beforeAll(async () => {
            const accounts = Object.fromEntries(supportedChains.map((chainId) => [chainId, [DEAD_ADDRESS]]));
            result = await source.getTokensHeldByAccounts({ accounts, config: { timeout: '1m' } });
          });

          validateBalances(() => result, supportedChains, false);
        }

        const unsupportedChains = Object.entries(sourceSupport)
          .filter(([, support]) => !support.getTokensHeldByAccount)
          .map(([chainId]) => Number(chainId));
        for (const chainId of unsupportedChains) {
          const chain = getChainByKey(chainId);
          test(`${chain?.name ?? `Chain with id ${chainId}`} fails as it's not supported`, async () => {
            await expect(source.getTokensHeldByAccounts({ accounts: { [chainId]: [] } })).to.eventually.be.rejectedWith(
              'Operation not supported'
            );
          });
        }
      });

      function validateBalances(
        result: () => Record<ChainId, Record<Address, Record<TokenAddress, AmountOfToken>>>,
        chains: ChainId[],
        shouldZeroBalanceBeShown: boolean
      ) {
        test(`Returned amount of chains is as expected`, () => {
          expect(Object.keys(result())).to.have.lengthOf(chains.length);
        });

        for (const chainId of chains) {
          const chain = getChainByKey(chainId);
          describe(chain?.name ?? `Chain with id ${chainId}`, () => {
            test(`Returned amount of accounts is as expected`, () => {
              expect(Object.keys(result()[chainId]).length).to.equal(1);
            });
            test(`Returned amount of tokens is as expected`, () => {
              let expectedTokenAmount = 1;
              if (chainId in TESTS) expectedTokenAmount++;
              expect(Object.keys(result()[chainId][DEAD_ADDRESS]).length).to.be.gte(expectedTokenAmount);
            });
            test(chain?.nativeCurrency?.symbol ?? 'Native token', () => {
              if (!shouldZeroBalanceBeShown && CHAINS_WITH_NO_NATIVE_TOKEN_ON_DEAD_ADDRESS.has(Number(chainId))) {
                expect(result()).to.not.have.keys([Addresses.NATIVE_TOKEN]);
              } else {
                // In this case, make sure there is some native balance
                validateTokenBalance({
                  result: result(),
                  chainId,
                  address: Addresses.NATIVE_TOKEN,
                  decimals: 18,
                  minAmount: CHAINS_WITH_NO_NATIVE_TOKEN_ON_DEAD_ADDRESS.has(Number(chainId)) ? '0' : (formatUnits(1n, 18) as `${number}`),
                });
              }
            });
            if (chainId in TESTS) {
              test(`${TESTS[chainId].symbol}`, () => {
                validateTokenBalance({ result: result(), chainId, ...TESTS[chainId] });
              });
            }
          });
        }
      }

      function validateTokenBalance({
        chainId,
        address,
        decimals,
        minAmount,
        result,
      }: {
        result: Record<ChainId, Record<Address, Record<TokenAddress, AmountOfToken>>>;
        chainId: ChainId | string;
        address: TokenAddress;
        decimals: number;
        minAmount: `${number}`;
      }) {
        const amount = BigInt(result[Number(chainId)][DEAD_ADDRESS][address]);
        expect(
          parseUnits(minAmount, decimals) <= amount,
          `Expected to have at least ${minAmount}. Instead found ${formatUnits(amount, decimals)}`
        ).to.be.true;
      }
    });
  }
});
