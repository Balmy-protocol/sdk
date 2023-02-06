import { ChainId } from '@types';
import { IProviderSource } from '@services/providers/types';
import { IGasPriceSource, GasSpeedPriceResult } from '@services/gas/types';

// We are using the provider here to calculate the gas price
type GasSpeedSupport = { standard: 'present' };
export class RPCGasPriceSource implements IGasPriceSource<GasSpeedSupport> {
  constructor(private readonly providerSource: IProviderSource) {}

  supportedChains(): ChainId[] {
    return this.providerSource.supportedChains();
  }

  supportedSpeeds(): GasSpeedSupport {
    return { standard: 'present' };
  }

  async getGasPrice(chainId: ChainId): Promise<GasSpeedPriceResult<GasSpeedSupport>> {
    const feeData = await this.providerSource.getProvider(chainId).getFeeData();
    const gasPrice =
      !!feeData.maxFeePerGas && !!feeData.maxPriorityFeePerGas
        ? { maxFeePerGas: feeData.maxFeePerGas.toString(), maxPriorityFeePerGas: feeData.maxPriorityFeePerGas.toString() }
        : { gasPrice: feeData.gasPrice!.toString() };
    return {
      standard: gasPrice,
    } as GasSpeedPriceResult<GasSpeedSupport>;
  }
}
