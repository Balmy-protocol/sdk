import { IGasPriceSource, IQuickGasCostCalculator, IQuickGasCostCalculatorBuilder } from '@services/gas/types';
import { Network } from '@types';

// This gas builder works by simply using the gas price provider to calculate gas costs. It will work independently from the network
export class GenericGasCalculatorBuilder implements IQuickGasCostCalculatorBuilder {
  constructor(private readonly gasPriceSource: IGasPriceSource) {}

  supportedNetworks(): Network[] {
    return this.gasPriceSource.supportedNetworks();
  }

  async build(network: Network): Promise<IQuickGasCostCalculator> {
    const gasPriceData = await this.gasPriceSource.getGasPrice(network);
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
