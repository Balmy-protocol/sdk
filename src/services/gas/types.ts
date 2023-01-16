import { TransactionRequest } from '@ethersproject/providers';
import { ChainId } from '@types';
import { BigNumber } from 'ethers';

export type GasPrice = LegacyGasPrice | EIP1159GasPrice;
export type GasSpeed = 'standard' | 'fast' | 'instant';
export type GasEstimation<ChainGasPrice extends GasPrice> = { gasCostNativeToken: BigNumber } & ChainGasPrice;

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
  getGasPrice(chainId: ChainId): Promise<Record<GasSpeed, GasPrice>>;
};

export type IQuickGasCostCalculatorBuilder = {
  supportedChains(): ChainId[];
  build(chainId: ChainId): Promise<IQuickGasCostCalculator>;
};

export type IQuickGasCostCalculator = {
  getGasPrice(speed?: GasSpeed): GasPrice;
  calculateGasCost(tx: TransactionRequest, gasEstimation: BigNumber, speed?: GasSpeed): GasEstimation<GasPrice>;
};

type EIP1159GasPrice = { maxFeePerGas: BigNumber; maxPriorityFeePerGas: BigNumber };
type LegacyGasPrice = { gasPrice: BigNumber };
