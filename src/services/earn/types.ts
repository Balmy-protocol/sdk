import { PermitData } from '@services/permit2';
import { Address, BigIntish, BuiltTransaction, ChainId, TimeString, TokenAddress } from '@types';
import { Hex } from 'viem';

export type IEarnService = {
  getAllowanceTarget(_: {
    chainId: ChainId;
    strategyId: BigIntish;
    depositWith: TokenAddress;
    usePermit2?: boolean;
  }): Promise<Address | undefined>;
  buildCreatePositionTx(_: CreateEarnPositionParams): Promise<BuiltTransaction>;
  buildIncreasePositionTx(_: IncreaseEarnPositionParams): Promise<BuiltTransaction>;
};

export type CreateEarnPositionParams = {
  chainId: ChainId;
  strategyId: BigIntish;
  owner: Address;
  permissions: EarnPermissionSet[];
  strategyValidationData?: Hex;
  misc?: Hex;
  deposit: AddFundsEarn;
};

export type IncreaseEarnPositionParams = {
  chainId: ChainId;
  positionId: BigIntish;
  increase: AddFundsEarn;
  permissionPermit?: EarnPermissionPermit;
};

export type EarnPermissionPermit = {
  permissions: EarnPermissionSet[];
  tokenId: string;
  deadline: BigIntish;
  signature: Hex;
};

export type EarnPermissionSet = { operator: string; permissions: EarnPermission[] };

export enum EarnPermission {
  INCREASE = 'INCREASE',
  WITHDRAW = 'WITHDRAW',
}
export type EarnActionSwapConfig = { slippagePercentage?: number; txValidFor?: TimeString };

export type AddFundsEarn = { swapConfig?: EarnActionSwapConfig } & (
  | { permitData: PermitData['permitData']; signature: string }
  | { token: TokenAddress; amount: BigIntish }
);
