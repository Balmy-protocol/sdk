import { PermitData, SinglePermitParams } from '@services/permit2';
import { Address, BigIntish, ChainId, TimeString, TokenAddress, BuiltTransaction, Timestamp } from '@types';

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
  }): Promise<Record<ChainId, { pairs: SupportedPair[]; tokens: Record<TokenAddress, DCAToken> }>>;
};

export type PairInChain = `${ChainId}-${TokenAddress}-${TokenAddress}`;
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
export type DCAToken = {
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
  variantId: string;
};
