import { TransactionRequest } from '@ethersproject/providers';
import { ChainId } from '@types';
import { UnionMerge } from '@utility-types';
import { BigNumber } from 'ethers';

export const AVAILABLE_GAS_SPEEDS = ['standard', 'fast', 'instant'] as const;
export type GasPrice = LegacyGasPrice | EIP1159GasPrice;
export type GasSpeed = (typeof AVAILABLE_GAS_SPEEDS)[number];
export type GasEstimation<ChainGasPrice extends GasPrice> = { gasCostNativeToken: BigNumber } & ChainGasPrice;
export type GasSpeedSupportRecord = Partial<Record<GasSpeed, GasSpeedSupport>> & { standard: 'present' };
export type GasSpeedPriceResult<SupportRecord extends GasSpeedSupportRecord, GasPriceVersion = GasPrice> = GasPriceForSpeed<
  PresentSpeeds<SupportRecord>,
  GasPriceVersion
> &
  Partial<GasPriceForSpeed<OptionalSpeeds<SupportRecord>, GasPriceVersion>> &
  Record<NotPresentSpeeds<SupportRecord>, never>;

export type IGasService = {
  supportedChains(): ChainId[];
  estimateGas(chainId: ChainId, tx: TransactionRequest): Promise<BigNumber>;
  getGasPrice(chainId: ChainId, options?: { speed?: GasSpeed }): Promise<GasPrice>;
  calculateGasCost(
    chainId: ChainId,
    tx: TransactionRequest,
    gasEstimation: BigNumber,
    options?: { speed?: GasSpeed }
  ): Promise<GasEstimation<GasPrice>>;
  getQuickGasCalculator(chainId: ChainId): Promise<IQuickGasCostCalculator>;
};

export type IGasPriceSource<SupportRecord extends GasSpeedSupportRecord> = {
  supportedChains(): ChainId[];
  supportedSpeeds(): SupportRecord;
  getGasPrice(chainId: ChainId): Promise<GasSpeedPriceResult<SupportRecord>>;
};

export type IQuickGasCostCalculatorBuilder = {
  supportedChains(): ChainId[];
  build(chainId: ChainId): Promise<IQuickGasCostCalculator>;
};

export type IQuickGasCostCalculator = {
  getGasPrice(speed?: GasSpeed): GasPrice;
  calculateGasCost(tx: TransactionRequest, gasEstimation: BigNumber, speed?: GasSpeed): GasEstimation<GasPrice>;
};

export type EIP1159GasPrice = { maxFeePerGas: BigNumber; maxPriorityFeePerGas: BigNumber };
export type LegacyGasPrice = { gasPrice: BigNumber };

type GasSpeedSupport = 'optional' | 'present';
type GasPriceForSpeed<SupportedGasSpeed extends GasSpeed, GasPriceVersion = GasPrice> = Record<SupportedGasSpeed, GasPriceVersion>;
type PresentSpeeds<SupportRecord extends GasSpeedSupportRecord> =
  | ({ [K in keyof SupportRecord]: SupportRecord[K] extends 'present' ? K : never }[keyof SupportRecord] & GasSpeed)
  | 'standard';
type OptionalSpeeds<SupportRecord extends GasSpeedSupportRecord> = Exclude<keyof SupportRecord, PresentSpeeds<SupportRecord>> & GasSpeed;
type NotPresentSpeeds<SupportRecord extends GasSpeedSupportRecord> = Exclude<GasSpeed, keyof SupportRecord> & GasSpeed;

type CombineGasSpeedSupportRecord<Sources extends IGasPriceSource<any>[] | []> = UnionMerge<
  { [K in keyof Sources]: Sources[K] extends IGasPriceSource<infer R> ? R : Sources[K] }[number]
>;
export type MergeGasSpeedSupportRecord<Sources extends IGasPriceSource<any>[] | []> = {
  [K in keyof CombineGasSpeedSupportRecord<Sources>]-?: undefined extends CombineGasSpeedSupportRecord<Sources>[K]
    ? 'optional'
    : CombineGasSpeedSupportRecord<Sources>[K];
} & { standard: 'present' };
