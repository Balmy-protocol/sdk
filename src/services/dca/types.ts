import { PermitData, SinglePermitParams } from '@services/permit2';
import { Address, BigIntish, ChainId, TimeString, TokenAddress, TransactionResponse } from '@types';

export type IDCAService = {
  management: IDCAPositionManagementService;
};

export type IDCAPositionManagementService = {
  preparePermitData(_: SinglePermitParams): Promise<PermitData>;
  buildCreatePositionTx(_: CreateDCAPositionParams): Promise<TransactionResponse>;
  buildIncreasePositionTx(_: IncreaseDCAPositionParams): Promise<TransactionResponse>;
  buildReducePositionTx(_: ReduceDCAPositionParams): Promise<TransactionResponse>;
  buildReduceToBuyPositionTx(_: ReduceToBuyDCAPositionParams): Promise<TransactionResponse>;
  buildWithdrawPositionTx(_: WithdrawDCAPositionParams): Promise<TransactionResponse>;
  buildTerminatePositionTx(_: TerminateDCAPositionParams): Promise<TransactionResponse>;
};

export enum DCAPermission {
  INCREASE,
  REDUCE,
  WITHDRAW,
  TERMINATE,
}

export enum DCASwapInterval {
  ONE_MINUTE = 60,
  FIVE_MINUTES = 300,
  FIFTEEN_MINUTES = 900,
  THIRTY_MINUTES = 1800,
  ONE_HOUR = 3600,
  FOUR_HOURS = 14400,
  ONE_DAY = 86400,
  ONE_WEEK = 604800,
}

export type DCAPermissionSet = { operator: string; permissions: DCAPermission[] };
export type CreateDCAPositionParams = {
  chainId: ChainId;
  from: PositionToken;
  to: PositionToken;
  swapInterval: DCASwapInterval;
  amountOfSwaps: number;
  owner: Address;
  permissions: DCAPermissionSet[];
  deposit: AddFunds;
};
export type IncreaseDCAPositionParams = {
  chainId: ChainId;
  positionId: BigIntish;
  increase?: AddFunds;
  amountOfSwaps: number;
  permissionPermit?: DCAPermissionPermit;
};
export type ReduceDCAPositionParams = {
  chainId: ChainId;
  positionId: BigIntish;
  amountOfSwaps: number;
  reduce: { amount: BigIntish; convertTo?: TokenAddress; swapConfig?: DCAActionSwapConfig };
  recipient: Address;
  permissionPermit?: DCAPermissionPermit;
};
export type ReduceToBuyDCAPositionParams = {
  chainId: ChainId;
  positionId: BigIntish;
  amountOfSwaps: number;
  reduce: { amountToBuy: BigIntish; convertTo?: TokenAddress; swapConfig?: DCAActionSwapConfig };
  recipient: Address;
  permissionPermit?: DCAPermissionPermit;
};
export type WithdrawDCAPositionParams = {
  chainId: ChainId;
  positionId: BigIntish;
  withdraw: { convertTo?: TokenAddress; swapConfig?: DCAActionSwapConfig };
  recipient: Address;
  permissionPermit?: DCAPermissionPermit;
};
export type TerminateDCAPositionParams = {
  chainId: ChainId;
  positionId: BigIntish;
  withdraw: { unswappedConvertTo?: TokenAddress; swappedConvertTo?: TokenAddress; swapConfig?: DCAActionSwapConfig };
  recipient: Address;
  permissionPermit?: DCAPermissionPermit;
};
export type DCAActionSwapConfig = { slippagePercentage?: number; txValidFor?: TimeString };
export type DCAPermissionPermit = {
  permissions: DCAPermissionSet[];
  tokenId: string;
  deadline: BigIntish;
  v: BigIntish;
  r: string;
  s: string;
};

export type AddFunds = { swapConfig?: DCAActionSwapConfig } & (
  | { nativeAmount: BigIntish }
  | { permitData: PermitData['permitData']; signature: string }
);

type PositionToken = {
  address: TokenAddress;
  variantId: string;
};
