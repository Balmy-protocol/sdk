import { Address, AmountOfToken, ChainId, TimeString, TokenAddress } from '@types';
import { BalanceQueriesSupport, IBalanceSource } from '../../types';

export abstract class OnlyTokensHeldBalanceSource implements IBalanceSource {
  supportedQueries(): Record<ChainId, BalanceQueriesSupport> {
    const entries = this.supportedChains().map((chainId) => [chainId, { getBalancesForTokens: true, getTokensHeldByAccount: true }]);
    return Object.fromEntries(entries);
  }

  async getBalancesForTokens({
    tokens,
    config,
  }: {
    tokens: Record<ChainId, Record<Address, TokenAddress[]>>;
    config?: { timeout?: TimeString };
  }): Promise<Record<ChainId, Record<Address, Record<TokenAddress, AmountOfToken>>>> {
    const entries: [ChainId, Address[]][] = Object.entries(tokens).map(([chainId, tokens]) => [Number(chainId), Object.keys(tokens)]);
    const tokensHeldByAccount = await this.getTokensHeldByAccounts({ accounts: Object.fromEntries(entries), config });
    const result: Record<ChainId, Record<Address, Record<TokenAddress, AmountOfToken>>> = {};
    for (const chainId in tokens) {
      result[chainId] = {};
      for (const account in tokens[chainId]) {
        result[chainId][account] = {};
        for (const token of tokens[chainId][account]) {
          result[chainId][account][token] = tokensHeldByAccount?.[chainId]?.[account]?.[token] ?? '0';
        }
      }
    }
    return result;
  }

  abstract getTokensHeldByAccounts(_: {
    accounts: Record<ChainId, Address[]>;
    config?: { timeout?: TimeString };
  }): Promise<Record<ChainId, Record<Address, Record<TokenAddress, AmountOfToken>>>>;
  protected abstract supportedChains(): ChainId[];
}
