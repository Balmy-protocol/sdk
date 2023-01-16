import { ChainId } from '@types';
import { IProviderSource } from '@services/providers/types';
import { IGasPriceSource, GasSpeed, GasPrice } from '@services/gas/types';

// We are using the provider here to calculate the gas price
export class ProviderGasPriceSource implements IGasPriceSource {
  constructor(private readonly providerSource: IProviderSource) {}

  supportedChains(): ChainId[] {
    return this.providerSource.supportedChains();
  }

  async getGasPrice(chainId: ChainId): Promise<Record<GasSpeed, GasPrice>> {
    const feeData = await this.providerSource.getProvider(chainId).getFeeData();
    const gasPrice =
      'maxFeePerGas' in feeData
        ? { maxFeePerGas: feeData.maxFeePerGas!, maxPriorityFeePerGas: feeData.maxPriorityFeePerGas! }
        : { gasPrice: feeData! };
    return {
      standard: gasPrice,
      fast: gasPrice,
      instant: gasPrice,
    };
  }
}
