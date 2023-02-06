import { Address, AmountOfToken, ChainId, TimeString, TokenAddress } from '@types';

export type BalanceQueriesSupport = {
  getTokensHeldByAccount: boolean;
  getBalancesForTokens: true;
};

export type IBalanceService = {
  supportedChains(): ChainId[];
  supportedQueries(): Record<ChainId, BalanceQueriesSupport>;
  getTokensHeldByAccount(_: {
    account: Address;
    chains: ChainId[];
    config?: { timeout?: TimeString };
  }): Promise<Record<ChainId, Record<TokenAddress, AmountOfToken>>>;
  getBalancesForTokens(_: {
    account: Address;
    tokens: Record<ChainId, TokenAddress[]>;
    config?: { timeout?: TimeString };
  }): Promise<Record<ChainId, Record<TokenAddress, AmountOfToken>>>;
};

export type IBalanceSource = {
  supportedQueries(): Record<ChainId, BalanceQueriesSupport>;
  getTokensHeldByAccount(_: {
    account: Address;
    chains: ChainId[];
    context?: { timeout?: TimeString };
  }): Promise<Record<ChainId, Record<TokenAddress, AmountOfToken>>>;
  getBalancesForTokens(_: {
    account: Address;
    tokens: Record<ChainId, TokenAddress[]>;
    context?: { timeout?: TimeString };
  }): Promise<Record<ChainId, Record<TokenAddress, AmountOfToken>>>;
};
