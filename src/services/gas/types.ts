import { TransactionRequest } from "@ethersproject/providers";
import { Network } from "@types"
import { BigNumber } from "ethers";

export type GasPrice = LegacyGasPrice | EIP1159GasPrice
export type GasSpeed = 'standard' | 'fast' | 'instant'
export type GasEstimation<NetworkGasPrice extends GasPrice> = { gasCostNativeToken: BigNumber } & NetworkGasPrice

export type IGasService = {
  supportedNetworks(): Network[];
  estimateGas(network: Network, tx: TransactionRequest): Promise<BigNumber>;
  getGasPrice(network: Network, options?: { speed?: GasSpeed }): Promise<GasPrice>
  calculateGasCost(network: Network, tx: TransactionRequest, gasEstimation: BigNumber, options?: { speed?: GasSpeed }): Promise<GasEstimation<GasPrice>>;
  getQuickGasCalculator(network: Network): Promise<IQuickGasCostCalculator>;
}

export type IGasPriceSource = {
  supportedNetworks(): Network[],
  getGasPrice(network: Network): Promise<Record<GasSpeed, GasPrice>>,
}

export type IQuickGasCostCalculatorBuilder = {
  supportedNetworks(): Network[];
  build(network: Network): Promise<IQuickGasCostCalculator>;
}

export type IQuickGasCostCalculator = {
  getGasPrice(speed?: GasSpeed): GasPrice
  calculateGasCost(tx: TransactionRequest, gasEstimation: BigNumber, speed?: GasSpeed): GasEstimation<GasPrice>
}

type EIP1159GasPrice = { maxFeePerGas: BigNumber, maxPriorityFeePerGas: BigNumber }
type LegacyGasPrice = { gasPrice: BigNumber }