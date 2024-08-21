import { PermitData, SinglePermitParams } from '@services/permit2';
import { Address, BigIntish, BuiltTransaction, ChainId, TimeString, TokenAddress } from '@types';
import { Hex } from 'viem';

export type IEarnService = {
  getAllowanceTarget(_: {
    chainId: ChainId;
    strategyId: BigIntish;
    depositWith: TokenAddress;
    usePermit2?: boolean;
  }): Promise<Address | undefined>;
  preparePermitData(_: SinglePermitParams): Promise<PermitData>;
  buildCreatePositionTx(_: CreateEarnPositionParams): Promise<BuiltTransaction>;
  buildIncreasePositionTx(_: IncreaseEarnPositionParams): Promise<BuiltTransaction>;
  buildWithdrawPositionTx(_: WithdrawEarnPositionParams): Promise<BuiltTransaction>;
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

export type WithdrawEarnPositionParams = {
  chainId: ChainId;
  positionId: BigIntish;
  withdraw: { token: TokenAddress; amount: BigIntish; convertTo?: TokenAddress; swapConfig?: EarnActionSwapConfig }[];
  recipient: Address;
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
