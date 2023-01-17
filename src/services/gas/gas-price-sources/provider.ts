import { ChainId } from '@types';
import { IProviderSource } from '@services/providers/types';
import { IGasPriceSource, GasPriceForSpeed } from '@services/gas/types';
import { BigNumber } from 'ethers';

// We are using the provider here to calculate the gas price
export class ProviderGasPriceSource implements IGasPriceSource {
  constructor(private readonly providerSource: IProviderSource) {}

  supportedChains(): ChainId[] {
    return this.providerSource.supportedChains();
  }

  async getGasPrice(chainId: ChainId): Promise<GasPriceForSpeed> {
    const feeData = await this.providerSource.getProvider(chainId).getFeeData();
    const gasPrice = BigNumber.isBigNumber(feeData.maxFeePerGas)
      ? { maxFeePerGas: feeData.maxFeePerGas!, maxPriorityFeePerGas: feeData.maxPriorityFeePerGas! }
      : { gasPrice: feeData.gasPrice! };
    return {
      standard: gasPrice,
      fast: gasPrice,
      instant: gasPrice,
    } as GasPriceForSpeed;
  }
}
