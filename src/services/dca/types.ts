import { PermitData, SinglePermitParams } from '@services/permit2';
import { Address, BigIntish, ChainId, TimeString, TokenAddress, BuiltTransaction, Timestamp } from '@types';
import { ArrayOneOrMore } from '@utility-types';

export type IDCAService = {
  getAllowanceTarget(_: { chainId: ChainId; from: TokenAddress; depositWith: TokenAddress; usePermit2?: boolean }): Address;
  preparePermitData(_: SinglePermitParams): Promise<PermitData>;
  buildCreatePositionTx(_: CreateDCAPositionParams): Promise<BuiltTransaction>;
  buildIncreasePositionTx(_: IncreaseDCAPositionParams): Promise<BuiltTransaction>;
  buildReducePositionTx(_: ReduceDCAPositionParams): Promise<BuiltTransaction>;
  buildReduceToBuyPositionTx(_: ReduceToBuyDCAPositionParams): Promise<BuiltTransaction>;
  buildWithdrawPositionTx(_: WithdrawDCAPositionParams): Promise<BuiltTransaction>;
  buildTerminatePositionTx(_: TerminateDCAPositionParams): Promise<BuiltTransaction>;
  buildMigratePositionTx(_: MigrateDCAPositionParams): Promise<BuiltTransaction>;

  getSupportedPairs(_?: {
    chains?: ChainId[];
    config?: { timeout: TimeString };
  }): Promise<Record<ChainId, { pairs: SupportedPair[]; tokens: Record<TokenAddress, SupportedDCAToken> }>>;
  getPositionsByAccount(_: {
    accounts: ArrayOneOrMore<Address>;
    chains?: ChainId[];
    includeHistory?: boolean;
    config?: { timeout: TimeString };
  }): Promise<Record<ChainId, PositionSummary[]>>;
  getPositionsById(_: {
    ids: ArrayOneOrMore<{ chainId: ChainId; hub: Address; positionId: number }>;
    includeHistory?: boolean;
    config?: { timeout: TimeString };
  }): Promise<Record<ChainId, PositionSummary[]>>;
  getPairSwaps(_: {
    chainId: ChainId;
    variantTokenA: TokenVariantId;
    variantTokenB: TokenVariantId;
    config?: { timeout: TimeString };
  }): Promise<{ tokenA: TokenInPair; tokenB: TokenInPair; swaps: DCASwap[] }>;
};

export type PairInChain = `${ChainId}-${TokenAddress}-${TokenAddress}`;
export type PositionId = `${ChainId}-${Address}-${bigint}`;
export type PositionSummary = {
  id: PositionId;
  createdAt: Timestamp;
  chainId: ChainId;
  hub: Address;
  tokenId: bigint;
  pair: {
    pairId: string;
    variantPairId: TokenVariantPair;
  };
  from: DCAPositionToken;
  to: DCAPositionToken;
  swapInterval: DCASwapInterval;
  owner: Address;
  remainingSwaps: number;
  totalSwaps: number;
  executedSwaps: number;
  isStale: boolean;
  status: 'ongoing' | 'empty' | 'terminated' | 'finished';
  nextSwapAvailableAt: Timestamp;
  permissions: Record<Address, DCAPermission[]>;
  rate: bigint;
  funds: PositionFunds;
  yield?: Partial<PositionFunds>;
  platformMessages: PlatformMessage[];
  history: DCAPositionAction[];
};
export type DCAPositionAction = { tx: DCATransaction } & ActionType;
export type ActionType =
  | CreatedAction
  | ModifiedAction
  | WithdrawnAction
  | TerminatedAction
  | TransferredAction
  | PermissionsModifiedAction
  | SwappedAction;
export type CreatedAction = {
  action: 'created';
  rate: bigint;
  swaps: number;
  owner: Address;
  permissions: Record<Address, DCAPermission[]>;
  fromPrice?: number;
};
export type ModifiedAction = {
  action: 'modified';
  rate: bigint;
  remainingSwaps: number;
  oldRate: bigint;
  oldRemainingSwaps: number;
  fromPrice?: number;
};
export type WithdrawnAction = {
  action: 'withdrawn';
  withdrawn: bigint;
  yield?: { withdrawn: bigint };
  toPrice?: number;
};
export type TerminatedAction = {
  action: 'terminated';
  withdrawnRemaining: bigint;
  withdrawnSwapped: bigint;
  yield?: {
    withdrawnRemaining?: bigint;
    withdrawnSwapped?: bigint;
  };
  fromPrice?: number;
  toPrice?: number;
};
export type TransferredAction = {
  action: 'transferred';
  from: Address;
  to: Address;
};
export type PermissionsModifiedAction = {
  action: 'modified permissions';
  permissions: Record<Address, DCAPermission[]>;
};
export type SwappedAction = {
  action: 'swapped';
  rate: bigint;
  swapped: bigint;
  ratioAToB: bigint;
  ratioBToA: bigint;
  ratioAToBWithFee: bigint;
  ratioBToAWithFee: bigint;
  yield?: {
    rate: bigint;
  };
  tokenA: { address: TokenAddress; price?: number };
  tokenB: { address: TokenAddress; price?: number };
};
export type DCATransaction = {
  hash: string;
  timestamp: Timestamp;
  gasPrice?: bigint;
  l1GasPrice?: bigint;
  overhead?: bigint;
};
export type PositionFunds = {
  swapped: bigint;
  remaining: bigint;
  toWithdraw: bigint;
};
export type DCAPositionToken = {
  address: TokenAddress;
  symbol: string;
  name: string;
  decimals: number;
  price?: number;
  variant: TokenVariant;
};
export type PlatformMessage = {
  id: string;
  generated: Timestamp;
  message: string;
};
export type SupportedPair = {
  chainId: ChainId;
  id: PairInChain;
  tokenA: TokenAddress;
  tokenB: TokenAddress;
  swapIntervals: Record<string, SwapIntervalData>;
};
export type SwapIntervalData = {
  seconds: number;
  nextSwapAvailableAt: Record<TokenVariantPair, Timestamp>;
  isStale: Record<TokenVariantPair, boolean>;
};
export type TokenVariantPair = `${TokenVariantId}-${TokenVariantId}`;
export type SupportedDCAToken = {
  symbol: string;
  decimals: number;
  name: string;
  variants: TokenVariant[];
  price?: number;
};
export type TokenVariant = { id: TokenVariantId } & (TokenVariantOriginal | TokenVariantWrapper | TokenVariantYield);
export type TokenVariantOriginal = { type: 'original' };
export type TokenVariantWrapper = { type: 'wrapper' };
export type TokenVariantYield = { type: 'yield'; apy: number; platform: string; tvl: number };
export type TokenVariantId = string;

export enum DCAPermission {
  INCREASE = 'INCREASE',
  REDUCE = 'REDUCE',
  WITHDRAW = 'WITHDRAW',
  TERMINATE = 'TERMINATE',
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
export type TokenInPair = {
  address: TokenAddress;
  symbol: string;
  decimals: number;
  name: string;
  price?: number;
  variant: TokenVariant;
};
export type DCASwap = {
  executedAt: Timestamp;
  ratioAToB: bigint;
  ratioBToA: bigint;
  ratioAToBWithFee: bigint;
  ratioBToAWithFee: bigint;
  intervalsInSwap: DCASwapInterval[];
};

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
  dcaHub?: Address;
};
export type ReduceDCAPositionParams = {
  chainId: ChainId;
  positionId: BigIntish;
  amountOfSwaps: number;
  reduce: { amount: BigIntish; convertTo?: TokenAddress; swapConfig?: DCAActionSwapConfig };
  recipient: Address;
  permissionPermit?: DCAPermissionPermit;
  dcaHub?: Address;
};
export type ReduceToBuyDCAPositionParams = {
  chainId: ChainId;
  positionId: BigIntish;
  amountOfSwaps: number;
  reduce: { amountToBuy: BigIntish; convertTo?: TokenAddress; swapConfig?: DCAActionSwapConfig };
  recipient: Address;
  permissionPermit?: DCAPermissionPermit;
  dcaHub?: Address;
};
export type WithdrawDCAPositionParams = {
  chainId: ChainId;
  positionId: BigIntish;
  withdraw: { convertTo?: TokenAddress; swapConfig?: DCAActionSwapConfig };
  recipient: Address;
  permissionPermit?: DCAPermissionPermit;
  dcaHub?: Address;
};
export type TerminateDCAPositionParams = {
  chainId: ChainId;
  positionId: BigIntish;
  withdraw: { unswappedConvertTo?: TokenAddress; swappedConvertTo?: TokenAddress; swapConfig?: DCAActionSwapConfig };
  recipient: Address;
  permissionPermit?: DCAPermissionPermit;
  dcaHub?: Address;
};
export type MigrateDCAPositionParams = {
  chainId: ChainId;
  sourceHub: Address;
  targetHub: Address;
  positionId: BigIntish;
  permissionPermit?: DCAPermissionPermit;
  migration: PositionMigration & { newFrom?: PositionToken; newTo?: PositionToken; swapConfig?: DCAActionSwapConfig };
};

type PositionMigration =
  | { useFundsFrom: 'swapped' | 'unswapped'; sendUnusedFundsTo: Address }
  | { useFundsFrom: 'both'; sendUnusedFundsTo?: undefined };

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
  | { permitData: PermitData['permitData']; signature: string }
  | { token: TokenAddress; amount: BigIntish }
);

type PositionToken = {
  address: TokenAddress;
  variantId: TokenVariantId;
};
