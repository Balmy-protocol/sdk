import { PublicClient } from 'viem';
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

  getGasPrice<Requirements extends FieldsRequirements<GasValues>>({ chainId, config }: { chainId: ChainId; config?: { timeout?: TimeString } }) {
    const client = this.providerService.getViemPublicClient({ chainId });
    const promise = calculatePrice(client);
    return timeoutPromise(promise, config?.timeout) as Promise<GasPriceResult<GasValues, Requirements>>;
  }
}

async function calculatePrice(client: PublicClient) {
  // We need to specify a type, or viem will default to eip1559 and fail if the chain doesn't support it. So we've looked into what viem does
  // and we realized that it will fetch a block, and then return the latest price. So we fetch it first to determine the time, and then pass
  // it to viem, even though it doesn't accept it "publicly". But it does use it nevertheless and it doesn't fetch a new one
  const block = await client.getBlock();
  const type = typeof block.baseFeePerGas === 'bigint' ? 'eip1559' : 'legacy';
  const feeData = await client.estimateFeesPerGas({ block, type } as any);
  const gasPrice =
    feeData.maxFeePerGas !== undefined && feeData.maxPriorityFeePerGas !== undefined
      ? { standard: { maxFeePerGas: feeData.maxFeePerGas, maxPriorityFeePerGas: feeData.maxPriorityFeePerGas } }
      : { standard: { gasPrice: feeData.gasPrice! } };
  return gasPrice;
}
