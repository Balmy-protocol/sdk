import { TransactionRequest } from '@ethersproject/providers';
import { ChainId } from '@types';
import { BigNumber } from 'ethers';

export const GAS_SPEEDS = ['standard', 'fast', 'instant'] as const;
export type GasPrice = LegacyGasPrice | EIP1159GasPrice;
export type GasSpeed = (typeof GAS_SPEEDS)[number];
export type GasEstimation<ChainGasPrice extends GasPrice> = { gasCostNativeToken: BigNumber } & ChainGasPrice;
export type GasPriceForSpeed = Record<GasSpeed, LegacyGasPrice> | Record<GasSpeed, EIP1159GasPrice>;

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

export type IGasPriceSource = {
  supportedChains(): ChainId[];
  getGasPrice(chainId: ChainId): Promise<GasPriceForSpeed>;
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
