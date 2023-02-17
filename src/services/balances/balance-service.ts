import { Address, AmountOfToken, ChainId, TimeString, TokenAddress } from '@types';
import { BalanceQueriesSupport, IBalanceService, IBalanceSource } from './types';
import { timeoutPromise } from '@shared/timeouts';

export class BalanceService implements IBalanceService {
  constructor(private readonly source: IBalanceSource) {}

  supportedChains(): ChainId[] {
    return Object.entries(this.supportedQueries())
      .filter(([, support]) => support.getBalancesForTokens || support.getBalancesForTokens)
      .map(([chainId]) => Number(chainId));
  }

  supportedQueries(): Record<ChainId, BalanceQueriesSupport> {
    return this.source.supportedQueries();
  }

  async getTokensHeldByAccount({
    account,
    chains,
    config,
  }: {
    account: Address;
    chains: ChainId[];
    config?: { timeout?: TimeString };
  }): Promise<Record<ChainId, Record<TokenAddress, AmountOfToken>>> {
    const entries = chains.map((chainId) => [chainId, [account]]);
    const accounts = Object.fromEntries(entries);
    const resultsPerAccounts = await this.getTokensHeldByAccounts({ accounts, config });
    const result: Record<ChainId, Record<TokenAddress, AmountOfToken>> = {};
    for (const chainId of chains) {
      result[chainId] = resultsPerAccounts[chainId][account];
    }
    return result;
  }

  async getBalancesForTokens({
    account,
    tokens,
    config,
  }: {
    account: Address;
    tokens: Record<ChainId, TokenAddress[]>;
    config?: { timeout?: TimeString };
  }): Promise<Record<ChainId, Record<TokenAddress, AmountOfToken>>> {
    const entries = Object.entries(tokens).map<[ChainId, Record<Address, TokenAddress[]>]>(([chainId, tokens]) => [
      Number(chainId),
      { account: tokens },
    ]);
    const resultsPerAccounts = await this.getBalancesForTokensForAccounts({ tokens: Object.fromEntries(entries), config });
    const result: Record<ChainId, Record<TokenAddress, AmountOfToken>> = {};
    for (const chainId in tokens) {
      result[chainId] = resultsPerAccounts[chainId][account];
    }
    return result;
  }

  getTokensHeldByAccounts({
    accounts,
    config,
  }: {
    accounts: Record<ChainId, Address[]>;
    config?: { timeout?: TimeString };
  }): Promise<Record<ChainId, Record<Address, Record<TokenAddress, AmountOfToken>>>> {
    return timeoutPromise(this.source.getTokensHeldByAccounts({ accounts, context: config }), config?.timeout);
  }

  getBalancesForTokensForAccounts({
    tokens,
    config,
  }: {
    tokens: Record<ChainId, Record<Address, TokenAddress[]>>;
    config?: { timeout?: TimeString };
  }): Promise<Record<ChainId, Record<Address, Record<TokenAddress, AmountOfToken>>>> {
    return timeoutPromise(this.source.getBalancesForTokens({ tokens, context: config }), config?.timeout);
  }
}
