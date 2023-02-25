import { GasSpeed, IGasPriceSource, IQuickGasCostCalculator, IQuickGasCostCalculatorBuilder } from '@services/gas/types';
import { ChainId, TimeString } from '@types';
import { BigNumber } from 'ethers';

// This gas builder works by simply using the gas price provider to calculate gas costs. It will work independently from the chain
export class GenericGasCalculatorBuilder implements IQuickGasCostCalculatorBuilder {
  constructor(private readonly gasPriceSource: IGasPriceSource<any>) {}

  supportedChains(): ChainId[] {
    return Object.keys(this.gasPriceSource.supportedSpeeds()).map(Number);
  }

  async build({ chainId, context }: { chainId: ChainId; context?: { timeout?: TimeString } }): Promise<IQuickGasCostCalculator> {
    const gasPriceData = await this.gasPriceSource.getGasPrice({ chainId, context });
    const getGasPriceForSpeed = (speed?: GasSpeed) => (speed && speed in gasPriceData ? gasPriceData[speed] : gasPriceData['standard']);
    return {
      getGasPrice: ({ speed }) => getGasPriceForSpeed(speed),
      calculateGasCost: ({ gasEstimation, speed }) => {
        const gasPriceForSpeed = getGasPriceForSpeed(speed);
        const actualGasPrice = 'maxFeePerGas' in gasPriceForSpeed ? gasPriceForSpeed.maxFeePerGas : gasPriceForSpeed.gasPrice;
        const gasCostNativeToken = BigNumber.from(gasEstimation).mul(actualGasPrice).toString();
        return { gasCostNativeToken, ...gasPriceForSpeed };
      },
    };
  }
}
