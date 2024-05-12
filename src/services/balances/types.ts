import { Address, ChainId, TimeString, TokenAddress } from '@types';

type Account = Address;

export type IBalanceService = {
  supportedChains(): ChainId[];
  getBalancesForAccountInChain(_: {
    chainId: ChainId;
    account: Address;
    tokens: TokenAddress[];
    config?: { timeout?: TimeString };
  }): Promise<Record<TokenAddress, bigint>>;
  getBalancesForAccount(_: {
    account: Address;
    tokens: Omit<BalanceInput, 'account'>[];
    config?: { timeout?: TimeString };
  }): Promise<Record<ChainId, Record<TokenAddress, bigint>>>;
  getBalancesInChain(_: {
    chainId: ChainId;
    tokens: Omit<BalanceInput, 'chainId'>[];
    config?: { timeout?: TimeString };
  }): Promise<Record<Account, Record<TokenAddress, bigint>>>;
  getBalances(_: {
    tokens: BalanceInput[];
    config?: { timeout?: TimeString };
  }): Promise<Record<ChainId, Record<Account, Record<TokenAddress, bigint>>>>;
};

export type IBalanceSource = {
  supportedChains(): ChainId[];
  getBalances(_: {
    tokens: BalanceInput[];
    config?: { timeout?: TimeString };
  }): Promise<Record<ChainId, Record<Account, Record<TokenAddress, bigint>>>>;
};

export type BalanceInput = {
  chainId: ChainId;
  account: Account;
  token: TokenAddress;
};
