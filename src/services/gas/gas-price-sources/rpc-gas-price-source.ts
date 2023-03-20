import { ChainId, FieldsRequirements, SupportRecord, TimeString } from '@types';
import { IProviderSource } from '@services/providers/types';
import { GasPriceResult, GasValueForVersions, IGasPriceSource } from '@services/gas/types';
import { timeoutPromise } from '@shared/timeouts';

// We are using the provider here to calculate the gas price
type GasValues = GasValueForVersions<'standard'>;
export class RPCGasPriceSource implements IGasPriceSource<GasValues> {
  constructor(private readonly providerSource: IProviderSource) {}

  supportedSpeeds() {
    const support: SupportRecord<GasValues> = { standard: 'present' };
    return Object.fromEntries(this.providerSource.supportedChains().map((chainId) => [Number(chainId), support]));
  }

  async getGasPrice<Requirements extends FieldsRequirements<GasValues>>({
    chainId,
    config,
  }: {
    chainId: ChainId;
    config?: { timeout?: TimeString };
  }) {
    const feeData = await timeoutPromise(this.providerSource.getProvider({ chainId }).getFeeData(), config?.timeout);
    const gasPrice =
      !!feeData.maxFeePerGas && !!feeData.maxPriorityFeePerGas
        ? { standard: { maxFeePerGas: feeData.maxFeePerGas.toString(), maxPriorityFeePerGas: feeData.maxPriorityFeePerGas.toString() } }
        : { standard: { gasPrice: feeData.gasPrice!.toString() } };
    return gasPrice as GasPriceResult<GasValues, Requirements>;
  }
}
