import { Address, ChainId, TimeString, TokenAddress } from '@types';

type Account = Address;

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
  }): Promise<Record<ChainId, Record<TokenAddress, bigint>>>;
  getBalancesForTokens(_: {
    account: Address;
    tokens: Record<ChainId, TokenAddress[]>;
    config?: { timeout?: TimeString };
  }): Promise<Record<ChainId, Record<TokenAddress, bigint>>>;
  getTokensHeldByAccounts(_: {
    accounts: Record<ChainId, Account[]>;
    config?: { timeout?: TimeString };
  }): Promise<Record<ChainId, Record<Account, Record<TokenAddress, bigint>>>>;
  getBalancesForTokensForAccounts(_: {
    tokens: Record<ChainId, Record<Account, TokenAddress[]>>;
    config?: { timeout?: TimeString };
  }): Promise<Record<ChainId, Record<Account, Record<TokenAddress, bigint>>>>;
};

export type IBalanceSource = {
  supportedQueries(): Record<ChainId, BalanceQueriesSupport>;
  getTokensHeldByAccounts(_: {
    accounts: Record<ChainId, Account[]>;
    config?: { timeout?: TimeString };
  }): Promise<Record<ChainId, Record<Account, Record<TokenAddress, bigint>>>>;
  getBalancesForTokens(_: {
    tokens: Record<ChainId, Record<Account, TokenAddress[]>>;
    config?: { timeout?: TimeString };
  }): Promise<Record<ChainId, Record<Account, Record<TokenAddress, bigint>>>>;
};
