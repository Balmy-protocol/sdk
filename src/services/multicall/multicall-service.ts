import { Address, ChainId } from '@types';
import { IProviderService } from '@services/providers/types';
import { ExecuteCallAt, IMulticallService, MulticallArgs } from './types';
import { chainsIntersection } from '@chains';
import { Address as ViemAddress, parseAbi } from 'viem';

const ADDRESS = '0xcA11bde05977b3631167028862bE2a173976CA11';
export class MulticallService implements IMulticallService {
  constructor(private readonly providerService: IProviderService) {}

  supportedChains(): ChainId[] {
    return chainsIntersection(this.providerService.supportedChains(), SUPPORTED_CHAINS);
  }

  async readOnlyMulticall(args: MulticallArgs): Promise<any[]> {
    if (args.calls.length === 0) return [];
    return this.viemMulticall({ ...args, allowFailure: false });
  }

  async tryReadOnlyMulticall(args: MulticallArgs) {
    if (args.calls.length === 0) return [];
    const results = await this.viemMulticall({ ...args, allowFailure: true });
    return results.map(({ error, status, result }) => (status === 'success' ? { status, result } : { status, error: error.message }));
  }

  private async viemMulticall<TAllowFailure extends boolean>({
    chainId,
    calls,
    at,
    allowFailure,
    batching,
  }: {
    chainId: ChainId;
    calls: {
      address: Address;
      abi: { humanReadable: string[] } | { json: readonly any[] };
      functionName: string;
      args?: any[];
    }[];
    allowFailure: TAllowFailure;
    batching?: { maxSizeInBytes: number };
    at?: ExecuteCallAt;
  }) {
    return this.providerService.getViemPublicClient({ chainId }).multicall({
      allowFailure,
      multicallAddress: ADDRESS,
      contracts: calls.map(({ address, abi, functionName, args }) => ({
        address: address as ViemAddress,
        abi: 'humanReadable' in abi ? parseAbi(abi.humanReadable) : abi.json,
        functionName,
        args,
      })),
      blockNumber: at?.block?.number ? BigInt(at.block.number) : undefined,
      batchSize: batching?.maxSizeInBytes ?? 0,
    });
  }
}

const SUPPORTED_CHAINS: ChainId[] = [
  1, 3, 4, 5, 10, 14, 16, 18, 19, 25, 30, 31, 40, 42, 56, 66, 69, 97, 100, 106, 108, 114, 122, 128, 137, 250, 288, 321, 420, 592, 1088, 1284,
  1285, 1287, 2001, 4002, 8217, 9000, 9001, 42161, 42170, 42220, 42262, 43113, 43114, 44787, 71401, 71402, 80001, 84531, 421611, 421613,
  11155111, 1313161554, 1666600000,
];
