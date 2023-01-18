import { TransactionRequest } from '@ethersproject/providers';
import { ChainId } from '@types';
import { BigNumber } from 'ethers';
import { OpenOceanGasPriceSource } from './gas-price-sources/open-ocean';

export const AVAILABLE_GAS_SPEEDS = ['standard', 'fast', 'instant'] as const;
export type GasPrice = LegacyGasPrice | EIP1159GasPrice;
export type GasSpeed = (typeof AVAILABLE_GAS_SPEEDS)[number];
export type GasEstimation<ChainGasPrice extends GasPrice> = { gasCostNativeToken: BigNumber } & ChainGasPrice;
export type GasPriceForSpeed<SupportedGasSpeed extends GasSpeed> =
  | Record<SupportedGasSpeed, LegacyGasPrice>
  | Record<SupportedGasSpeed, EIP1159GasPrice>;

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

export type IGasPriceSource<SupportedGasSpeed extends GasSpeed> = {
  supportedChains(): ChainId[];
  supportedSpeeds(): (SupportedGasSpeed | 'standard')[];
  getGasPrice(chainId: ChainId): Promise<GasPriceForSpeed<SupportedGasSpeed | 'standard'>>;
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

export type MergeGasSpeedsFromSources<T extends IGasPriceSource<any>[] | []> = (
  | { [K in keyof T]: T[K] extends IGasPriceSource<infer R> ? R : T[K] }[number]
  | 'standard'
) &
  GasSpeed;
