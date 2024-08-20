import { PermitData } from '@services/permit2';
import { Address, BigIntish, BuiltTransaction, ChainId, TimeString, TokenAddress } from '@types';
import { Hex } from 'viem';

export type IEarnService = {
  buildCreatePositionTx(_: CreateEarnPositionParams): Promise<BuiltTransaction>;
  buildIncreasePositionTx(_: IncreaseEarnPositionParams): Promise<BuiltTransaction>;
};

export type CreateEarnPositionParams = {
  chainId: ChainId;
  strategyId: bigint;
  owner: Address;
  permissions: EarnPermissionSet[];
  strategyValidationData?: Hex;
  misc?: Hex;
  deposit: AddFunds;
};

export type IncreaseEarnPositionParams = {
  chainId: ChainId;
  positionId: BigIntish;
  increase: AddFunds;
  permissionPermit?: EarnPermissionPermit;
};

export type EarnPermissionPermit = {
  permissions: EarnPermissionSet[];
  tokenId: string;
  deadline: BigIntish;
  v: BigIntish;
  r: string;
  s: string;
};

export type EarnPermissionSet = { operator: string; permissions: EarnPermission[] };

export enum EarnPermission {
  INCREASE = 'INCREASE',
  WITHDRAW = 'WITHDRAW',
}
export type EarnActionSwapConfig = { slippagePercentage?: number; txValidFor?: TimeString };

export type AddFunds = { swapConfig?: EarnActionSwapConfig } & (
  | { permitData: PermitData['permitData']; signature: string }
  | { token: TokenAddress; amount: BigIntish }
);
