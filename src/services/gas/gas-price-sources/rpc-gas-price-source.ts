import { ChainId, TimeString } from '@types';
import { IProviderSource } from '@services/providers/types';
import { IGasPriceSource, GasSpeedPriceResult } from '@services/gas/types';
import { timeoutPromise } from '@shared/timeouts';

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

  async getGasPrice({ chainId, context }: { chainId: ChainId; context?: { timeout?: TimeString } }) {
    const feeData = await timeoutPromise(this.providerSource.getProvider({ chainId }).getFeeData(), context?.timeout);
    const gasPrice =
      !!feeData.maxFeePerGas && !!feeData.maxPriorityFeePerGas
        ? { maxFeePerGas: feeData.maxFeePerGas.toString(), maxPriorityFeePerGas: feeData.maxPriorityFeePerGas.toString() }
        : { gasPrice: feeData.gasPrice!.toString() };
    return {
      standard: gasPrice,
    } as GasSpeedPriceResult<GasSpeedSupport>;
  }
}
