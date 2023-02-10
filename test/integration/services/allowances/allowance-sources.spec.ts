import ms from 'ms';
import { expect } from 'chai';
import { MulticallService } from '@services/multicall/multicall-service';
import { PublicRPCsSource } from '@services/providers/provider-sources/public-providers';
import { AllowanceCheck, IAllowanceSource, OwnerAddress, SpenderAddress } from '@services/allowances/types';
import { RPCAllowanceSource } from '@services/allowances//allowance-sources/rpc-allowance-source';
import { CachedAllowanceSource } from '@services/allowances//allowance-sources/cached-allowance-source';
import { Chains } from '@chains';
import { AmountOfToken, ChainId, TokenAddress } from '@types';
import { BigNumber } from 'ethers';

const OWNER = '0x49c590F6a2dfB0f809E82B9e2BF788C0Dd1c31f9'; // DCAHubCompanion
const SPENDER = '0xA5AdC5484f9997fBF7D405b9AA62A7d88883C345'; // DCAHub
const TESTS: Record<ChainId, { address: TokenAddress; symbol: string }> = {
  [Chains.OPTIMISM.chainId]: {
    address: '0xfe7296c374d996d09e2ffe533eeb85d1896e1b14',
    symbol: 'waUSDC',
  },
  [Chains.POLYGON.chainId]: {
    address: '0xe3e5e1946d6e4d8a5e5f155b6e059a2ca7c43c58',
    symbol: 'waUSDC',
  },

  [Chains.ARBITRUM.chainId]: {
    address: '0x2285b7dc4426c29ed488c65c72a9feaadb44c7ae',
    symbol: 'waUSDC',
  },
  [Chains.ETHEREUM.chainId]: {
    address: '0xCd0E5871c97C663D43c62B5049C123Bb45BfE2cC',
    symbol: 'waUSDC',
  },
};
const RPC_ALLOWANCE_SOURCE = new RPCAllowanceSource(new MulticallService(new PublicRPCsSource()));
const CACHED_ALLOWANCE_SOURCE = new CachedAllowanceSource(RPC_ALLOWANCE_SOURCE, {
  useCachedValue: 'always',
  useCachedValueIfCalculationFailed: 'always',
});

jest.retryTimes(2);
jest.setTimeout(ms('1m'));

describe('Allowance Sources', () => {
  allowanceSourceTest({ title: 'RPC Source', source: RPC_ALLOWANCE_SOURCE });
  allowanceSourceTest({ title: 'Cached RPC Source', source: CACHED_ALLOWANCE_SOURCE });

  function allowanceSourceTest({ title, source }: { title: string; source: IAllowanceSource }) {
    describe(title, () => {
      const chains = source.supportedChains().filter((chainId) => chainId in TESTS);
      let input: Record<ChainId, AllowanceCheck[]>;
      let result: Record<ChainId, Record<TokenAddress, Record<OwnerAddress, Record<SpenderAddress, AmountOfToken>>>>;
      beforeAll(async () => {
        const entries = chains.map((chainId) => [chainId, [{ token: TESTS[chainId].address, owner: OWNER, spender: SPENDER }]]);
        input = Object.fromEntries(entries);
        result = await source.getAllowances({ allowances: input });
      });

      test(`Returned amount of chains is as expected`, () => {
        expect(Object.keys(result)).to.have.lengthOf(chains.length);
      });

      for (const chainId of chains) {
        const chain = Chains.byKey(chainId);
        describe(chain?.name ?? `Chain with id ${chainId}`, () => {
          test(`Returned amount of tokens is as expected`, () => {
            expect(Object.keys(result[chainId])).to.have.lengthOf(1);
            expect(Object.keys(result[chainId][TESTS[chainId].address])).to.have.lengthOf(1);
            expect(Object.keys(result[chainId][TESTS[chainId].address][OWNER])).to.have.lengthOf(1);
          });
          test(`${TESTS[chainId].symbol}`, () => {
            const amount = BigNumber.from(result[chainId][TESTS[chainId].address][OWNER][SPENDER]);
            const minExpected = BigNumber.from(2).pow(200);
            expect(amount.gte(minExpected)).to.be.true;
          });
        });
      }
    });
  }
});