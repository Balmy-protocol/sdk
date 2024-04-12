import { expect } from 'chai';
import { Chains } from '@chains';
import { Address, ChainId, TimeString, TokenAddress } from '@types';
import { BalanceQueriesSupport, IBalanceService, IBalanceSource } from '@services/balances/types';
import { BalanceService } from '@services/balances/balance-service';
import { given } from '@test-utils/bdd';

const OWNER = '0x1a00e1E311009E56e3b0B9Ed6F86f5Ce128a1C01';

const DAI = '0x6b175474e89094c44da98b954eedeac495271d0f';
const USDC = '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48';
const WETH = '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2';

const SUPPORT: Record<ChainId, BalanceQueriesSupport> = {
  [Chains.ETHEREUM.chainId]: {
    getBalancesForTokens: true,
    getTokensHeldByAccount: false,
  },
};

describe('Balance Service', () => {
  let service: IBalanceService;
  given(() => {
    service = new BalanceService(SOURCE);
  });

  test('supportedQueries is calculated based on source', () => {
    expect(service.supportedQueries()).to.eql(SUPPORT);
  });

  describe('getBalancesForTokens', () => {
    test('Returned balances is as expected', async () => {
      const balances = await service.getBalancesForTokens({
        account: OWNER,
        tokens: {
          [Chains.ETHEREUM.chainId]: [DAI, USDC, WETH],
        },
      });
      expect(balances).to.have.keys(Chains.ETHEREUM.chainId);
      expect(balances[Chains.ETHEREUM.chainId]).to.have.keys([DAI, USDC, WETH]);
      expect(balances[Chains.ETHEREUM.chainId][DAI]).to.equal(0n);
      expect(balances[Chains.ETHEREUM.chainId][USDC]).to.equal(10000n);
      expect(balances[Chains.ETHEREUM.chainId][WETH]).to.equal(20000n);
    });
  });
});

const SOURCE: IBalanceSource = {
  supportedQueries(): Record<ChainId, BalanceQueriesSupport> {
    return SUPPORT;
  },
  getTokensHeldByAccounts(_: {
    accounts: Record<ChainId, Address[]>;
    config?: { timeout?: TimeString };
  }): Promise<Record<ChainId, Record<Address, Record<TokenAddress, bigint>>>> {
    throw new Error('Not implemented');
  },
  getBalancesForTokens({
    tokens,
  }: {
    tokens: Record<ChainId, Record<Address, TokenAddress[]>>;
    config?: { timeout?: TimeString };
  }): Promise<Record<ChainId, Record<Address, Record<TokenAddress, bigint>>>> {
    const result: Record<ChainId, Record<Address, Record<TokenAddress, bigint>>> = {};
    for (const [chainIdString, record] of Object.entries(tokens)) {
      const chainId = Number(chainIdString);
      result[chainId] = {};
      for (const [address, tokens] of Object.entries(record)) {
        result[chainId][address] = {};
        for (let i = 0; i < tokens.length; i++) {
          result[chainId][address][tokens[i]] = BigInt(i * 10000);
        }
      }
    }
    return Promise.resolve(result);
  },
};
