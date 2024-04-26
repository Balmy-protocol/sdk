import { ChainId, FieldsRequirements, SupportRecord, TimeString } from '@types';
import { IProviderService } from '@services/providers/types';
import { GasPriceResult, GasValueForVersions, IGasPriceSource } from '@services/gas/types';
import { timeoutPromise } from '@shared/timeouts';

// We are using the provider here to calculate the gas price
type GasValues = GasValueForVersions<'standard'>;
export class RPCGasPriceSource implements IGasPriceSource<GasValues> {
  constructor(private readonly providerService: IProviderService) {}

  supportedSpeeds() {
    const support: SupportRecord<GasValues> = { standard: 'present' };
    return Object.fromEntries(this.providerService.supportedChains().map((chainId) => [Number(chainId), support]));
  }

  async getGasPrice<Requirements extends FieldsRequirements<GasValues>>({
    chainId,
    config,
  }: {
    chainId: ChainId;
    config?: { timeout?: TimeString };
  }) {
    const feeData = await timeoutPromise(this.providerService.getViemPublicClient({ chainId }).estimateFeesPerGas(), config?.timeout);
    const gasPrice =
      !!feeData.maxFeePerGas && !!feeData.maxPriorityFeePerGas
        ? { standard: { maxFeePerGas: feeData.maxFeePerGas, maxPriorityFeePerGas: feeData.maxPriorityFeePerGas } }
        : { standard: { gasPrice: feeData.gasPrice! } };
    return gasPrice as GasPriceResult<GasValues, Requirements>;
  }
}
