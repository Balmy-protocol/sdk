import { TransactionRequest } from '@ethersproject/providers';
import { AmountOfToken, ChainId, TimeString } from '@types';
import { UnionMerge } from '@utility-types';
import { BigNumberish } from 'ethers';

export const AVAILABLE_GAS_SPEEDS = ['standard', 'fast', 'instant'] as const;
export type GasPrice = LegacyGasPrice | EIP1159GasPrice;
export type GasSpeed = (typeof AVAILABLE_GAS_SPEEDS)[number];
export type GasEstimation<ChainGasPrice extends GasPrice> = { gasCostNativeToken: AmountOfToken } & ChainGasPrice;
export type GasSpeedSupportRecord = Partial<Record<GasSpeed, GasSpeedSupport>> & { standard: 'present' };
export type GasSpeedPriceResult<SupportRecord extends GasSpeedSupportRecord, GasPriceVersion = GasPrice> = GasPriceForSpeed<
  PresentSpeeds<SupportRecord>,
  GasPriceVersion
> &
  Partial<GasPriceForSpeed<OptionalSpeeds<SupportRecord>, GasPriceVersion>> &
  Record<NotPresentSpeeds<SupportRecord>, never>;

export type IGasService = {
  supportedChains(): ChainId[];
  estimateGas(_: { chainId: ChainId; tx: TransactionRequest; config?: { timeout?: TimeString } }): Promise<AmountOfToken>;
  getGasPrice(_: { chainId: ChainId; config?: { speed?: GasSpeed; timeout?: TimeString } }): Promise<GasPrice>;
  calculateGasCost(_: {
    chainId: ChainId;
    gasEstimation: BigNumberish;
    tx?: TransactionRequest;
    config?: { speed?: GasSpeed; timeout?: TimeString };
  }): Promise<GasEstimation<GasPrice>>;
  getQuickGasCalculator(_: { chainId: ChainId; config?: { timeout?: TimeString } }): Promise<IQuickGasCostCalculator>;
};

export type IGasPriceSource<SupportRecord extends GasSpeedSupportRecord> = {
  supportedChains(): ChainId[];
  supportedSpeeds(): SupportRecord;
  getGasPrice(_: { chainId: ChainId; context: { timeout?: TimeString } | undefined }): Promise<GasSpeedPriceResult<SupportRecord>>;
};

export type IQuickGasCostCalculatorBuilder = {
  supportedChains(): ChainId[];
  build(_: { chainId: ChainId; context: { timeout?: TimeString } | undefined }): Promise<IQuickGasCostCalculator>;
};

export type IQuickGasCostCalculator = {
  getGasPrice(_: { speed?: GasSpeed }): GasPrice;
  calculateGasCost(_: { gasEstimation: BigNumberish; tx?: TransactionRequest; speed?: GasSpeed }): GasEstimation<GasPrice>;
};

export type EIP1159GasPrice = { maxFeePerGas: AmountOfToken; maxPriorityFeePerGas: AmountOfToken };
export type LegacyGasPrice = { gasPrice: AmountOfToken };

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
