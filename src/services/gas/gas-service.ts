import { TransactionRequest } from '@ethersproject/providers';
import { Network } from '@types';
import { BigNumber } from 'ethers';
import { networksIntersection } from '@networks';
import { IProviderSource } from '@services/providers/types';
import { GasEstimation, GasPrice, GasSpeed, IGasService, IQuickGasCostCalculatorBuilder, IQuickGasCostCalculator } from './types';

type ConstructorParameters = {
  providerSource: IProviderSource;
  gasCostCalculatorBuilder: IQuickGasCostCalculatorBuilder;
};

export class GasService implements IGasService {
  private readonly providerSource: IProviderSource;
  private readonly gasCostCalculatorBuilder: IQuickGasCostCalculatorBuilder;

  constructor({ providerSource, gasCostCalculatorBuilder }: ConstructorParameters) {
    this.providerSource = providerSource;
    this.gasCostCalculatorBuilder = gasCostCalculatorBuilder;
  }

  supportedNetworks(): Network[] {
    return networksIntersection(this.providerSource.supportedNetworks(), this.gasCostCalculatorBuilder.supportedNetworks());
  }

  estimateGas(network: Network, tx: TransactionRequest): Promise<BigNumber> {
    return this.providerSource.getProvider(network).estimateGas(tx);
  }

  getQuickGasCalculator(network: Network): Promise<IQuickGasCostCalculator> {
    return this.gasCostCalculatorBuilder.build(network);
  }

  async getGasPrice(network: Network, options?: { speed?: GasSpeed }): Promise<GasPrice> {
    const gasCalculator = await this.getQuickGasCalculator(network);
    return gasCalculator.getGasPrice(options?.speed);
  }

  async calculateGasCost(
    network: Network,
    tx: TransactionRequest,
    gasEstimation: BigNumber,
    options?: { speed?: GasSpeed }
  ): Promise<GasEstimation<GasPrice>> {
    const gasCalculator = await this.getQuickGasCalculator(network);
    return gasCalculator.calculateGasCost(tx, gasEstimation, options?.speed);
  }
}
