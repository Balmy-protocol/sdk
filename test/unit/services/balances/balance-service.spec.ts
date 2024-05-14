import { expect } from 'chai';
import { Chains } from '@chains';
import { Address, ChainId, TimeString, TokenAddress } from '@types';
import { BalanceInput, IBalanceService, IBalanceSource } from '@services/balances/types';
import { BalanceService } from '@services/balances/balance-service';
import { given } from '@test-utils/bdd';

const OWNER = '0x1a00e1E311009E56e3b0B9Ed6F86f5Ce128a1C01';

const DAI = '0x6b175474e89094c44da98b954eedeac495271d0f';
const USDC = '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48';
const WETH = '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2';

describe('Balance Service', () => {
  let service: IBalanceService;
  given(() => {
    service = new BalanceService(SOURCE);
  });

  test('supportedChains is calculated based on source', () => {
    expect(service.supportedChains()).to.eql([Chains.ETHEREUM.chainId]);
  });

  describe('getBalancesForTokens', () => {
    test('Returned balances is as expected', async () => {
      const balances = await service.getBalancesForAccountInChain({
        account: OWNER,
        chainId: Chains.ETHEREUM.chainId,
        tokens: [DAI, USDC, WETH],
      });
      expect(balances).to.have.keys([DAI, USDC, WETH]);
      expect(balances[DAI]).to.equal(0n);
      expect(balances[USDC]).to.equal(10000n);
      expect(balances[WETH]).to.equal(20000n);
    });
  });
});

const SOURCE: IBalanceSource = {
  supportedChains() {
    return [Chains.ETHEREUM.chainId];
  },
  getBalances({
    tokens,
  }: {
    tokens: BalanceInput[];
    config?: { timeout?: TimeString };
  }): Promise<Record<ChainId, Record<Address, Record<TokenAddress, bigint>>>> {
    const result: Record<ChainId, Record<Address, Record<TokenAddress, bigint>>> = {};
    for (let i = 0; i < tokens.length; i++) {
      const { chainId, token, account } = tokens[i];
      if (!(chainId in result)) result[chainId] = {};
      if (!(account in result[chainId])) result[chainId][account] = {};
      result[chainId][account][token] = BigInt(i * 10000);
    }
    return Promise.resolve(result);
  },
};
