import {
  AmountOfToken,
  BigIntish,
  BasedOnRequirements,
  ChainId,
  DefaultRequirements,
  FieldsRequirements,
  SupportInChain,
  TimeString,
  TransactionRequest,
} from '@types';
import { UnionMerge } from '@utility-types';

export const AVAILABLE_GAS_SPEEDS = ['standard', 'fast', 'instant'] as const;
export type GasPrice = LegacyGasPrice | EIP1159GasPrice;
export type GasSpeed = (typeof AVAILABLE_GAS_SPEEDS)[number];
export type GasEstimation<
  GasValues extends SupportedGasValues,
  Requirements extends FieldsRequirements<GasValues> = DefaultRequirements<AddGasCost<GasValues>>
> = GasPriceResult<AddGasCost<GasValues>, Requirements>;

export type IGasService<GasValues extends SupportedGasValues = DefaultGasValues> = {
  supportedChains(): ChainId[];
  supportedSpeeds(): Record<ChainId, SupportInChain<GasValues>>;
  estimateGas(_: { chainId: ChainId; tx: TransactionRequest; config?: { timeout?: TimeString } }): Promise<AmountOfToken>;
  getGasPrice<Requirements extends FieldsRequirements<GasValues> = DefaultRequirements<GasValues>>(_: {
    chainId: ChainId;
    config?: { timeout?: TimeString; fields?: Requirements };
  }): Promise<GasPriceResult<GasValues, Requirements>>;
  calculateGasCost<Requirements extends FieldsRequirements<GasValues> = DefaultRequirements<GasValues>>(_: {
    chainId: ChainId;
    gasEstimation: BigIntish;
    tx?: TransactionRequest;
    config?: { timeout?: TimeString; fields?: Requirements };
  }): Promise<GasEstimation<GasValues, Requirements>>;
  getQuickGasCalculator<Requirements extends FieldsRequirements<GasValues> = DefaultRequirements<GasValues>>(_: {
    chainId: ChainId;
    config?: { timeout?: TimeString; fields?: Requirements };
  }): Promise<IQuickGasCostCalculator<GasValues, Requirements>>;
};

export type IQuickGasCostCalculator<
  GasValues extends SupportedGasValues = DefaultGasValues,
  Requirements extends FieldsRequirements<GasValues> = DefaultRequirements<GasValues>
> = {
  supportedSpeeds(): SupportInChain<GasValues>;
  getGasPrice(): GasPriceResult<GasValues, Requirements>;
  calculateGasCost(_: { gasEstimation: BigIntish; tx?: TransactionRequest }): GasEstimation<GasValues, Requirements>;
};

export type IGasPriceSource<GasValues extends SupportedGasValues> = {
  supportedSpeeds(): Record<ChainId, SupportInChain<GasValues>>;
  getGasPrice<Requirements extends FieldsRequirements<GasValues>>(_: {
    chainId: ChainId;
    config?: { fields?: Requirements; timeout?: TimeString };
  }): Promise<GasPriceResult<GasValues, Requirements>>;
};

export type SupportedGasValues = Partial<Record<GasSpeed, EIP1159GasPrice | LegacyGasPrice>>;
export type GasValueForVersion<Speed extends GasSpeed, GasPriceVersion extends GasPrice> = Record<Speed, GasPriceVersion>;
export type GasValueForVersions<Speed extends GasSpeed> = Record<Speed, EIP1159GasPrice | LegacyGasPrice>;
export type GasPriceResult<
  GasValues extends SupportedGasValues,
  Requirements extends FieldsRequirements<GasValues> = DefaultRequirements<GasValues>
> = BasedOnRequirements<GasValues, Requirements>;
export type MergeGasValues<Sources extends IGasPriceSource<object>[] | []> = UnionMerge<
  { [K in keyof Sources]: ExtractGasValues<Sources[K]> }[number]
>;
export type ExtractGasValues<Source extends IGasPriceSource<object>> = Source extends IGasPriceSource<infer R> ? R : never;

export type EIP1159GasPrice = { maxFeePerGas: AmountOfToken; maxPriorityFeePerGas: AmountOfToken };
export type LegacyGasPrice = { gasPrice: AmountOfToken };

export type DefaultGasValues = GasValueForVersions<GasSpeed>;
type AddGasCost<GasValues extends SupportedGasValues> = { [K in keyof GasValues]: GasValues[K] & { gasCostNativeToken: AmountOfToken } };
