import { IGasPriceSource, IQuickGasCostCalculator, IQuickGasCostCalculatorBuilder } from '@services/gas/types';
import { ChainId } from '@types';

// This gas builder works by simply using the gas price provider to calculate gas costs. It will work independently from the chain
export class GenericGasCalculatorBuilder implements IQuickGasCostCalculatorBuilder {
  constructor(private readonly gasPriceSource: IGasPriceSource) {}

  supportedChains(): ChainId[] {
    return this.gasPriceSource.supportedChains();
  }

  async build(chainId: ChainId): Promise<IQuickGasCostCalculator> {
    const gasPriceData = await this.gasPriceSource.getGasPrice(chainId);
    return {
      getGasPrice: (speed) => gasPriceData[speed ?? 'standard'],
      calculateGasCost: (tx, gasEstimation, speed) => {
        const gasPriceForSpeed = gasPriceData[speed ?? 'standard'];
        const actualGasPrice = 'maxFeePerGas' in gasPriceForSpeed ? gasPriceForSpeed.maxFeePerGas : gasPriceForSpeed.gasPrice;
        const gasCostNativeToken = gasEstimation.mul(actualGasPrice);
        return { gasCostNativeToken, ...gasPriceForSpeed };
      },
    };
  }
}
