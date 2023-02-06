import ms from 'ms';
import chai, { expect } from 'chai';
import { MulticallService } from '@services/multicall/multicall-service';
import { PublicProvidersSource } from '@services/providers/provider-sources/public-providers';
import { RPCBalanceSource } from '@services/balances/balance-sources/rpc-balance-source';
import { Chains } from '@chains';
import { Addresses } from '@shared/constants';
import { AmountOfToken, ChainId, TokenAddress } from '@types';
import { utils } from 'ethers';
import { IBalanceSource } from '@services/balances/types';
import chaiAsPromised from 'chai-as-promised';
import { formatUnits } from 'ethers/lib/utils';
chai.use(chaiAsPromised);

const TESTS: Record<ChainId, { address: TokenAddress; minAmount: string; decimals: number; symbol: string }> = {
  [Chains.OPTIMISM.chainId]: {
    address: '0xda10009cbd5d07dd0cecc66161fc93d7c9000da1',
    minAmount: '6.519182750064400737',
    decimals: 18,
    symbol: 'DAI',
  },
  [Chains.POLYGON.chainId]: { address: '0x2791bca1f2de4661ed88a30c99a7a9449aa84174', minAmount: '141.765676', decimals: 6, symbol: 'USDC' },
  [Chains.ARBITRUM.chainId]: {
    address: '0xfc5A1A6EB076a2C7aD06eD22C90d7E710E35ad0a',
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
  [Chains.ETHEREUM.chainId]: { address: '0x2260fac5e5542a773aa44fbcfedf7c193bc2c599', minAmount: '0.00104291', decimals: 8, symbol: 'WBTC' },
};
const CHAINS_WITH_NO_NATIVE_TOKEN_ON_DEAD_ADDRESS: Set<ChainId> = new Set([Chains.AURORA.chainId, Chains.OASIS_EMERALD.chainId]);

const DEAD_ADDRESS = '0x000000000000000000000000000000000000dead';

const PROVIDER_SOURCE = new PublicProvidersSource();
const RPC_BALANCE_SOURCE = new RPCBalanceSource(PROVIDER_SOURCE, new MulticallService(PROVIDER_SOURCE));

jest.retryTimes(2);
jest.setTimeout(ms('1m'));

describe('Balance Sources', () => {
  balanceSourceTest({ title: 'RPC Source', source: RPC_BALANCE_SOURCE });

  function balanceSourceTest({ title, source }: { title: string; source: IBalanceSource }) {
    describe(title, () => {
      const sourceSupport = source.supportedQueries();

      describe('getBalancesForTokens', () => {
        let result: Record<ChainId, Record<TokenAddress, AmountOfToken>>;
        beforeAll(async () => {
          const chains = Object.keys(sourceSupport).map(Number);
          const entries = chains.map<[ChainId, TokenAddress[]]>((chainId) => {
            const addresses: TokenAddress[] = [Addresses.NATIVE_TOKEN];
            if (chainId in TESTS) addresses.push(TESTS[chainId].address);
            return [chainId, addresses];
          });
          const input = Object.fromEntries(entries);
          result = await source.getBalancesForTokens({ account: DEAD_ADDRESS, tokens: input, context: { timeout: '30s' } });
        });

        test('getBalancesForTokens is supported', () => {
          for (const { getBalancesForTokens } of Object.values(sourceSupport)) {
            expect(getBalancesForTokens).to.be.true;
          }
        });

        validateBalances(() => result, Object.keys(sourceSupport).length);
      });

      describe('getTokensHeldByAccount', () => {
        const supportedChains = Object.entries(sourceSupport)
          .filter(([, support]) => support.getTokensHeldByAccount)
          .map(([chainId]) => Number(chainId));

        if (supportedChains.length > 0) {
          let result: Record<ChainId, Record<TokenAddress, AmountOfToken>>;
          beforeAll(async () => {
            result = await source.getTokensHeldByAccount({ account: DEAD_ADDRESS, chains: supportedChains, context: { timeout: '30s' } });
          });

          validateBalances(() => result, supportedChains.length);
        }

        const unsupportedChains = Object.entries(sourceSupport)
          .filter(([, support]) => !support.getTokensHeldByAccount)
          .map(([chainId]) => Number(chainId));
        for (const chainId of unsupportedChains) {
          const chain = Chains.byKey(chainId);
          test(`${chain?.name ?? `Chain with id ${chainId}`} fails as it's not supported`, () => {
            expect(source.getTokensHeldByAccount({ account: DEAD_ADDRESS, chains: [chainId] })).to.eventually.be.rejectedWith(
              'Operation not supported'
            );
          });
        }
      });

      function validateBalances(result: () => Record<ChainId, Record<TokenAddress, AmountOfToken>>, expectedAmountOfChains: number) {
        test(`Returned amount of chains is as expected`, () => {
          expect(Object.keys(result())).to.have.lengthOf(expectedAmountOfChains);
        });

        for (const chainId in sourceSupport) {
          const chain = Chains.byKey(chainId);
          describe(chain?.name ?? `Chain with id ${chainId}`, () => {
            test(`Returned amount of tokens is as expected`, () => {
              const expectedTokenAmount = chainId in TESTS ? 2 : 1;
              expect(Object.keys(result()[chainId]).length).to.be.gte(expectedTokenAmount);
            });
            test(chain?.currencySymbol ?? 'Native token', () => {
              // In this case, make sure there is some native balance
              validateTokenBalance({
                result: result(),
                chainId,
                address: Addresses.NATIVE_TOKEN,
                decimals: 18,
                minAmount: CHAINS_WITH_NO_NATIVE_TOKEN_ON_DEAD_ADDRESS.has(Number(chainId)) ? '0' : formatUnits(1, 18),
              });
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
        result: Record<ChainId, Record<TokenAddress, AmountOfToken>>;
        chainId: ChainId | string;
        address: TokenAddress;
        decimals: number;
        minAmount: string;
      }) {
        const amount = result[Number(chainId)][address];
        expect(
          utils.parseUnits(minAmount, decimals).lte(amount),
          `Expected to have at least ${minAmount}. Instead found ${utils.formatUnits(amount, decimals)}`
        ).to.be.true;
      }
    });
  }
});