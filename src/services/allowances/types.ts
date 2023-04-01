import { Address, AmountOfToken, ChainId, TimeString, TokenAddress } from '@types';

export type OwnerAddress = Address;
export type SpenderAddress = Address;

export type IAllowanceService = {
  supportedChains(): ChainId[];
  getAllowance(_: {
    chainId: ChainId;
    token: TokenAddress;
    owner: OwnerAddress;
    spender: SpenderAddress;
    config?: { timeout?: TimeString };
  }): Promise<AmountOfToken>;
  getAllowances(_: {
    chainId: ChainId;
    token: TokenAddress;
    owner: OwnerAddress;
    spenders: SpenderAddress[];
    config?: { timeout?: TimeString };
  }): Promise<Record<SpenderAddress, AmountOfToken>>;
  getMultipleAllowances(_: {
    chainId: ChainId;
    check: AllowanceCheck[];
    config?: { timeout?: TimeString };
  }): Promise<Record<TokenAddress, Record<OwnerAddress, Record<SpenderAddress, AmountOfToken>>>>;
};

export type IAllowanceSource = {
  supportedChains(): ChainId[];
  getAllowances(_: {
    allowances: Record<ChainId, AllowanceCheck[]>;
    config?: { timeout?: TimeString };
  }): Promise<Record<ChainId, Record<TokenAddress, Record<OwnerAddress, Record<SpenderAddress, AmountOfToken>>>>>;
};

export type AllowanceCheck = {
  token: TokenAddress;
  owner: Address;
  spender: Address;
};
