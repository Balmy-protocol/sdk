import { Address, ChainId, TimeString, TokenAddress } from '@types';

export type OwnerAddress = Address;
export type SpenderAddress = Address;

export type IAllowanceService = {
  supportedChains(): ChainId[];
  getAllowanceInChain(_: {
    chainId: ChainId;
    token: TokenAddress;
    owner: OwnerAddress;
    spender: SpenderAddress;
    config?: { timeout?: TimeString };
  }): Promise<bigint>;
  getAllowancesInChain(_: {
    chainId: ChainId;
    allowances: Omit<AllowanceInput, 'chainId'>[];
    config?: { timeout?: TimeString };
  }): Promise<Record<TokenAddress, Record<OwnerAddress, Record<SpenderAddress, bigint>>>>;
  getAllowances(_: {
    allowances: AllowanceInput[];
    config?: { timeout?: TimeString };
  }): Promise<Record<ChainId, Record<TokenAddress, Record<OwnerAddress, Record<SpenderAddress, bigint>>>>>;
};

export type IAllowanceSource = {
  supportedChains(): ChainId[];
  getAllowances(_: {
    allowances: AllowanceInput[];
    config?: { timeout?: TimeString };
  }): Promise<Record<ChainId, Record<TokenAddress, Record<OwnerAddress, Record<SpenderAddress, bigint>>>>>;
};

export type AllowanceInput = {
  chainId: ChainId;
  token: TokenAddress;
  owner: Address;
  spender: Address;
};
