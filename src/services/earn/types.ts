import { PermitData, SinglePermitParams } from '@services/permit2';
import { Address, BigIntish, BuiltTransaction, ChainId, Timestamp, TimeString, TokenAddress } from '@types';
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
  getSupportedStrategies(_?: { chains?: ChainId[]; config?: { timeout?: TimeString } }): Promise<Record<ChainId, Strategy[]>>;
  getStrategy(_?: { strategy: StrategyId; config?: { timeout?: TimeString } }): Promise<DetailedStrategy>;
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
  withdraw: {
    amounts: { token: TokenAddress; amount: BigIntish; convertTo?: TokenAddress }[];
    swapConfig?: EarnActionSwapConfig;
  };
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

type DetailedStrategy = Strategy & HistoricalData;

export type HistoricalData = {
  historicalAPY: {
    timestamp: Timestamp;
    apy: number;
  }[];

  historicalTVL: { timestamp: Timestamp; tvl: number }[];
};

export type Strategy = {
  id: StrategyId;
  chainId: ChainId;
  depositTokens: Token[];
  farm: StrategyFarm;
  guardian?: StrategyGuardian;
  tos?: string;
};

type StrategyFarm = {
  id: FarmId;
  name: string;
  asset: Token;
  rewards?: { tokens: Token[]; apy: number };
  tvl: number;
  type: StrategyYieldType;
  apy: number;
};

export type StrategyGuardian = {
  id: GuardianId;
  name: string;
  description: string;
  logo: string;
  fees: GuardianFee[];
};

export type Guardian = {
  name: string;
  description: string;
  logo: string;
};

export type Token = {
  symbol: string;
  name: string;
  decimals: number;
  price?: number;
};

type GuardianFee = {
  type: 'deposit' | 'withdraw' | 'performance' | 'rescue';
  percentage: number;
};

type StrategyIdNumber = number;
type StrategyRegistryAddress = Lowercase<Address>;
export type StrategyId = `${ChainId}-${StrategyRegistryAddress}-${StrategyIdNumber}`;
export type FarmId = `${ChainId}-${Lowercase<Address>}`;
export type GuardianId = string;
export enum StrategyYieldType {
  LENDING = 'LENDING',
  STAKING = 'STAKING',
  AGGREAGATOR = 'AGGREGATOR',
}
