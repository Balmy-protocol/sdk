import { PermitData, SinglePermitParams } from '@services/permit2';
import { Address, AmountsOfToken, BigIntish, BuiltTransaction, ChainId, Timestamp, TimeString, TokenAddress } from '@types';
import { ArrayOneOrMore } from '@utility-types';
import { Hex } from 'viem';

export type IEarnService = {
  getAllowanceTarget(_: {
    chainId: ChainId;
    strategyId: StrategyId;
    depositWith: TokenAddress;
    usePermit2?: boolean;
  }): Promise<Address | undefined>;
  preparePermitData(_: SinglePermitParams): Promise<PermitData>;
  buildCreatePositionTx(_: CreateEarnPositionParams): Promise<BuiltTransaction>;
  buildIncreasePositionTx(_: IncreaseEarnPositionParams): Promise<BuiltTransaction>;
  buildWithdrawPositionTx(_: WithdrawEarnPositionParams): Promise<BuiltTransaction>;
  getSupportedStrategies(_?: { chains?: ChainId[]; config?: { timeout?: TimeString } }): Promise<Record<ChainId, Strategy[]>>;
  getStrategy(_?: { strategy: StrategyId; config?: { timeout?: TimeString } }): Promise<DetailedStrategy>;
  getPositionsByAccount(_: {
    accounts: ArrayOneOrMore<Address>;
    chains?: ChainId[];
    includeHistory?: boolean;
    includeHistoricalBalancesFrom?: Timestamp;
    config?: { timeout?: TimeString };
  }): Promise<Record<ChainId, EarnPosition[]>>;
  getPositionsById(_: {
    ids: ArrayOneOrMore<PositionId>;
    includeHistory?: boolean;
    includeHistoricalBalancesFrom?: Timestamp;
    config?: { timeout?: TimeString };
  }): Promise<Record<ChainId, EarnPosition[]>>;
};

export type CreateEarnPositionParams = {
  chainId: ChainId;
  strategyId: StrategyId;
  owner: Address;
  permissions: EarnPermissionSet[];
  strategyValidationData?: Hex;
  misc?: Hex;
  deposit: AddFundsEarn;
};

export type IncreaseEarnPositionParams = {
  chainId: ChainId;
  positionId: PositionId;
  increase: AddFundsEarn;
  permissionPermit?: EarnPermissionPermit;
};

export type WithdrawEarnPositionParams = {
  chainId: ChainId;
  positionId: PositionId;
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

export type DetailedStrategy = Strategy & HistoricalData;

export type HistoricalData = {
  historicalAPY: {
    timestamp: Timestamp;
    apy: number;
  }[];

  historicalTVL: { timestamp: Timestamp; tvl: number }[];
};

export type Strategy = {
  id: StrategyId;
  depositTokens: Token[];
  farm: StrategyFarm;
  guardian?: StrategyGuardian;
  tos?: string;
  riskLevel?: StrategyRiskLevel;
};

export type StrategyFarm = {
  id: FarmId;
  chainId: ChainId;
  name: string;
  asset: Token;
  rewards?: { tokens: Token[]; apy: number };
  tvl: number;
  type: StrategyYieldType;
  apy: number;
};

export type StrategyGuardian = {
  id: GuardianId;
  fees: GuardianFee[];
} & Guardian;

export type Guardian = {
  name: string;
  description: string;
  logo: string;
  links?: {
    website?: string;
    twitter?: string;
    discord?: string;
  };
};

export type Token = {
  address: TokenAddress;
  symbol: string;
  name: string;
  decimals: number;
  price?: number;
};

export type GuardianFee = {
  type: GuardianFeeType;
  percentage: number;
};

export enum GuardianFeeType {
  DEPOSIT = 'deposit',
  WITHDRAW = 'withdraw',
  PERFORMANCE = 'performance',
  RESCUE = 'rescue',
}

export type StrategyIdNumber = number;
export type StrategyRegistryAddress = Lowercase<Address>;
export type StrategyId = `${ChainId}-${StrategyRegistryAddress}-${StrategyIdNumber}`;
export type FarmId = `${ChainId}-${Lowercase<Address>}`;
export type GuardianId = string;

export enum StrategyYieldType {
  LENDING = 'LENDING',
  STAKING = 'STAKING',
  AGGREAGATOR = 'AGGREGATOR',
}
export enum StrategyRiskLevel {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
}

export type EarnPosition = {
  id: PositionId;
  createdAt: Timestamp;
  owner: Address;
  permissions: EarnPermissions;
  strategy: Strategy;
  balances: { token: Token; amount: AmountsOfToken; profit: AmountsOfToken }[];
  history?: EarnPositionAction[];
  historicalBalances?: HistoricalBalance[];
};

export type HistoricalBalance = {
  timestamp: Timestamp;
  balances: { token: Token; amount: AmountsOfToken; profit: AmountsOfToken }[];
};

type ActionType = CreatedAction | IncreasedAction | WithdrewAction | TransferredAction | PermissionsModifiedAction;

type CreatedAction = {
  action: 'created';
  owner: Address;
  permissions: EarnPermissions;
  deposited: AmountsOfToken;
  assetPrice?: number;
};

type IncreasedAction = {
  action: 'increased';
  deposited: AmountsOfToken;
  assetPrice?: number;
};

type WithdrewAction = {
  action: 'withdrew';
  withdrawn: {
    token: Token; // With price
    amount: AmountsOfToken;
  }[];
  recipient: Address;
};

type TransferredAction = {
  action: 'transferred';
  from: Address;
  to: Address;
};

type PermissionsModifiedAction = {
  action: 'modified permissions';
  permissions: EarnPermissions;
};

type EarnPositionAction = { tx: Transaction } & ActionType;
type Transaction = {
  hash: string;
  timestamp: Timestamp;
};

type Permission = 'WITHDRAW' | 'INCREASE';
export type EarnPermissions = Record<Address, Permission[]>;

export type PositionId = `${ChainId}-${VaultAddress}-${PositionIdNumber}`;
export type PositionIdNumber = number;
export type VaultAddress = Lowercase<Address>;
