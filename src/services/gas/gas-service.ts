import { TransactionRequest } from '@ethersproject/providers';
import { ChainId } from '@types';
import { BigNumber } from 'ethers';
import { chainsIntersection } from '@chains';
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

  supportedChains(): ChainId[] {
    return chainsIntersection(this.providerSource.supportedChains(), this.gasCostCalculatorBuilder.supportedChains());
  }

  estimateGas(chainId: ChainId, tx: TransactionRequest): Promise<BigNumber> {
    return this.providerSource.getProvider(chainId).estimateGas(tx);
  }

  getQuickGasCalculator(chainId: ChainId): Promise<IQuickGasCostCalculator> {
    return this.gasCostCalculatorBuilder.build(chainId);
  }

  async getGasPrice(chainId: ChainId, options?: { speed?: GasSpeed }): Promise<GasPrice> {
    const gasCalculator = await this.getQuickGasCalculator(chainId);
    return gasCalculator.getGasPrice(options?.speed);
  }

  async calculateGasCost(
    chainId: ChainId,
    tx: TransactionRequest,
    gasEstimation: BigNumber,
    options?: { speed?: GasSpeed }
  ): Promise<GasEstimation<GasPrice>> {
    const gasCalculator = await this.getQuickGasCalculator(chainId);
    return gasCalculator.calculateGasCost(tx, gasEstimation, options?.speed);
  }
}
