import {
  GasEstimation,
  GasPrice,
  IGasPriceSource,
  IQuickGasCostCalculator,
  IQuickGasCostCalculatorBuilder,
  SupportedGasValues,
} from '@services/gas/types';
import { ChainId, FieldsRequirements, TimeString } from '@types';

// This gas builder works by simply using the gas price provider to calculate gas costs. It will work independently from the chain
export class GenericGasCalculatorBuilder<GasValues extends SupportedGasValues> implements IQuickGasCostCalculatorBuilder<GasValues> {
  constructor(private readonly gasPriceSource: IGasPriceSource<GasValues>) {}

  supportedSpeeds() {
    return this.gasPriceSource.supportedSpeeds();
  }

  async build<Requirements extends FieldsRequirements<GasValues>>({
    chainId,
    config,
  }: {
    chainId: ChainId;
    config?: { fields?: Requirements; timeout?: TimeString };
  }): Promise<IQuickGasCostCalculator<GasValues, Requirements>> {
    const support = this.supportedSpeeds()[chainId];
    const gasPriceData = await this.gasPriceSource.getGasPrice({ chainId, config });
    return {
      supportedSpeeds: () => support,
      getGasPrice: () => gasPriceData,
      calculateGasCost: ({ gasEstimation }) => {
        const result = {} as GasEstimation<GasValues, Requirements>;
        for (const [speed, gasPriceForSpeed] of Object.entries(gasPriceData) as [string, GasPrice][]) {
          const actualGasPrice = 'maxFeePerGas' in gasPriceForSpeed ? gasPriceForSpeed.maxFeePerGas : gasPriceForSpeed.gasPrice;
          const gasCostNativeToken = (BigInt(gasEstimation) * BigInt(actualGasPrice)).toString();
          (result as any)[speed] = { gasCostNativeToken, ...gasPriceForSpeed };
        }
        return result;
      },
    };
  }
}
