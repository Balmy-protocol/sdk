import { PermitData } from '@services/permit2';
import { Address, BigIntish, ChainId, TimeString, TokenAddress } from '@types';
import { Hex } from 'viem';

export type IEarnService = {};

export type CreateEarnPositionParams = {
  chainId: ChainId;
  strategyId: bigint;
  depositToken: TokenAddress;
  owner: Address;
  permissions: EarnPermissionSet[];
  strategyValidationData: Hex;
  misc: Hex;
  deposit: AddFunds;
};
export type EarnPermissionSet = { operator: string; permissions: EarnPermission[] };

export enum EarnPermission {
  INCREASE = 'INCREASE',
  WITHDRAW = 'WITHDRAW',
}
export type EarnActionSwapConfig = { slippagePercentage?: number; txValidFor?: TimeString };

export type AddFunds = { swapConfig?: EarnActionSwapConfig; maxApprove?: boolean } & (
  | { permitData: PermitData['permitData']; signature: string }
  | { token: TokenAddress; amount: BigIntish }
);
