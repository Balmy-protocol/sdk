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

  getTokensHeldByAccount({
    account,
    chains,
    config,
  }: {
    account: Address;
    chains: ChainId[];
    config?: { timeout?: TimeString };
  }): Promise<Record<ChainId, Record<TokenAddress, AmountOfToken>>> {
    return timeoutPromise(this.source.getTokensHeldByAccount({ account, chains, context: config }), config?.timeout);
  }

  getBalancesForTokens({
    account,
    tokens,
    config,
  }: {
    account: Address;
    tokens: Record<ChainId, TokenAddress[]>;
    config?: { timeout?: TimeString };
  }): Promise<Record<ChainId, Record<TokenAddress, AmountOfToken>>> {
    return timeoutPromise(this.source.getBalancesForTokens({ account, tokens, context: config }), config?.timeout);
  }
}
