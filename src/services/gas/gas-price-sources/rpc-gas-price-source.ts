import { ChainId, TimeString } from '@types';
import { IProviderSource } from '@services/providers/types';
import { IGasPriceSource } from '@services/gas/types';
import { timeoutPromise } from '@shared/timeouts';

// We are using the provider here to calculate the gas price
export class RPCGasPriceSource implements IGasPriceSource<'standard'> {
  constructor(private readonly providerSource: IProviderSource) {}

  supportedSpeeds(): Record<ChainId, 'standard'[]> {
    const speeds: 'standard'[] = ['standard'];
    return Object.fromEntries(this.providerSource.supportedChains().map((chainId) => [Number(chainId), speeds]));
  }

  async getGasPrice({ chainId, context }: { chainId: ChainId; context?: { timeout?: TimeString } }) {
    const feeData = await timeoutPromise(this.providerSource.getProvider({ chainId }).getFeeData(), context?.timeout);
    const gasPrice =
      !!feeData.maxFeePerGas && !!feeData.maxPriorityFeePerGas
        ? { standard: { maxFeePerGas: feeData.maxFeePerGas.toString(), maxPriorityFeePerGas: feeData.maxPriorityFeePerGas.toString() } }
        : { standard: { gasPrice: feeData.gasPrice!.toString() } };
    return gasPrice;
  }
}
