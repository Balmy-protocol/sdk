import { ChainId } from '@types';
import { IProviderSource } from '@services/providers/types';
import { IGasPriceSource, GasSpeedPriceResult } from '@services/gas/types';
import { BigNumber } from 'ethers';

// We are using the provider here to calculate the gas price
type GasSpeedSupport = { standard: 'present' };
export class ProviderGasPriceSource implements IGasPriceSource<GasSpeedSupport> {
  constructor(private readonly providerSource: IProviderSource) {}

  supportedChains(): ChainId[] {
    return this.providerSource.supportedChains();
  }

  supportedSpeeds(): GasSpeedSupport {
    return { standard: 'present' };
  }

  async getGasPrice(chainId: ChainId): Promise<GasSpeedPriceResult<GasSpeedSupport>> {
    const feeData = await this.providerSource.getProvider(chainId).getFeeData();
    const gasPrice = BigNumber.isBigNumber(feeData.maxFeePerGas)
      ? { maxFeePerGas: feeData.maxFeePerGas!, maxPriorityFeePerGas: feeData.maxPriorityFeePerGas! }
      : { gasPrice: feeData.gasPrice! };
    return {
      standard: gasPrice,
    } as GasSpeedPriceResult<GasSpeedSupport>;
  }
}
