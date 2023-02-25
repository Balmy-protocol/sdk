import { TransactionRequest } from '@ethersproject/providers';
import { AmountOfToken, ChainId, TimeString } from '@types';
import { BigNumberish } from 'ethers';

export const AVAILABLE_GAS_SPEEDS = ['standard', 'fast', 'instant'] as const;
export type GasPrice = LegacyGasPrice | EIP1159GasPrice;
export type GasSpeed = (typeof AVAILABLE_GAS_SPEEDS)[number];
export type GasEstimation<ChainGasPrice extends GasPrice> = { gasCostNativeToken: AmountOfToken } & ChainGasPrice;

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

export type IGasPriceSource<SupportedGasSpeeds extends GasSpeed> = {
  supportedSpeeds(): Record<ChainId, (SupportedGasSpeeds | 'standard')[]>;
  getGasPrice(_: { chainId: ChainId; context?: { timeout?: TimeString } }): Promise<GasPriceResult<SupportedGasSpeeds | 'standard'>>;
};

export type IQuickGasCostCalculatorBuilder = {
  supportedChains(): ChainId[];
  build(_: { chainId: ChainId; context?: { timeout?: TimeString } }): Promise<IQuickGasCostCalculator>;
};

export type IQuickGasCostCalculator = {
  getGasPrice(_: { speed?: GasSpeed }): GasPrice;
  calculateGasCost(_: { gasEstimation: BigNumberish; tx?: TransactionRequest; speed?: GasSpeed }): GasEstimation<GasPrice>;
};

export type EIP1159GasPrice = { maxFeePerGas: AmountOfToken; maxPriorityFeePerGas: AmountOfToken };
export type LegacyGasPrice = { gasPrice: AmountOfToken };

export type MergeGasSpeedsFromSources<T extends IGasPriceSource<any>[] | []> = (
  | { [K in keyof T]: T[K] extends IGasPriceSource<infer R> ? R : T[K] }[number]
  | 'standard'
) &
  GasSpeed;
export type GasPriceResult<SupportedGasSpeed extends GasSpeed> =
  | GasPriceForSpeed<SupportedGasSpeed, EIP1159GasPrice>
  | GasPriceForSpeed<SupportedGasSpeed, LegacyGasPrice>;
export type GasPriceForSpeed<SupportedGasSpeed extends GasSpeed, GasPriceVersion = GasPrice> = Record<
  SupportedGasSpeed | 'standard',
  GasPriceVersion
>;
