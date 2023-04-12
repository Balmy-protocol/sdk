import { AbiCoder } from 'ethers/lib/utils';
import { Address, ChainId } from '@types';
import { IProviderService } from '@services/providers/types';
import { IMulticallService } from './types';
import { chainsIntersection } from '@chains';

const ADDRESS = '0xcA11bde05977b3631167028862bE2a173976CA11';
export class MulticallService implements IMulticallService {
  private readonly ABI_CODER = new AbiCoder();
  constructor(private readonly providerService: IProviderService) {}

  supportedChains(): ChainId[] {
    return chainsIntersection(this.providerService.supportedChains(), SUPPORTED_CHAINS);
  }

  async readOnlyMulticall({
    chainId,
    calls,
  }: {
    chainId: ChainId;
    calls: { target: Address; calldata: string; decode: string[] }[];
  }): Promise<ReadonlyArray<any>[]> {
    if (calls.length === 0) return [];
    const simulation = await this.providerService.getViemClient({ chainId }).simulateContract({
      address: ADDRESS,
      abi: MULTICALL_ABI,
      functionName: 'aggregate',
      args: [calls.map(({ target, calldata }) => [target, calldata])],
      blockTag: 'latest',
    });
    return (simulation.result as [number, string[]])[1].map((result, i) => this.ABI_CODER.decode(calls[i].decode, result));
  }

  async tryReadOnlyMulticall({ chainId, calls }: { chainId: ChainId; calls: { target: Address; calldata: string; decode: string[] }[] }) {
    const simulation = await this.providerService.getViemClient({ chainId }).simulateContract({
      address: ADDRESS,
      abi: MULTICALL_ABI,
      functionName: 'tryAggregate',
      args: [false, calls.map(({ target, calldata }) => [target, calldata])],
      blockTag: 'latest',
    });
    return (simulation.result as { success: boolean; returnData: string }[]).map(({ success, returnData }, i) =>
      success ? { success, result: this.ABI_CODER.decode(calls[i].decode, returnData) } : { success }
    );
  }
}

const MULTICALL_ABI = [
  {
    inputs: [
      {
        components: [
          {
            internalType: 'address',
            name: 'target',
            type: 'address',
          },
          {
            internalType: 'bytes',
            name: 'callData',
            type: 'bytes',
          },
        ],
        internalType: 'struct Multicall3.Call[]',
        name: 'calls',
        type: 'tuple[]',
      },
    ],
    name: 'aggregate',
    outputs: [
      {
        internalType: 'uint256',
        name: 'blockNumber',
        type: 'uint256',
      },
      {
        internalType: 'bytes[]',
        name: 'returnData',
        type: 'bytes[]',
      },
    ],
    stateMutability: 'payable',
    type: 'function',
  },
  {
    inputs: [
      {
        internalType: 'bool',
        name: 'requireSuccess',
        type: 'bool',
      },
      {
        components: [
          {
            internalType: 'address',
            name: 'target',
            type: 'address',
          },
          {
            internalType: 'bytes',
            name: 'callData',
            type: 'bytes',
          },
        ],
        internalType: 'struct Multicall3.Call[]',
        name: 'calls',
        type: 'tuple[]',
      },
    ],
    name: 'tryAggregate',
    outputs: [
      {
        components: [
          {
            internalType: 'bool',
            name: 'success',
            type: 'bool',
          },
          {
            internalType: 'bytes',
            name: 'returnData',
            type: 'bytes',
          },
        ],
        internalType: 'struct Multicall3.Result[]',
        name: 'returnData',
        type: 'tuple[]',
      },
    ],
    stateMutability: 'payable',
    type: 'function',
  },
];

const SUPPORTED_CHAINS: ChainId[] = [
  1, 3, 4, 5, 10, 14, 16, 18, 19, 25, 30, 31, 40, 42, 56, 66, 69, 97, 100, 106, 108, 114, 122, 128, 137, 250, 288, 321, 420, 592, 1088, 1284,
  1285, 1287, 2001, 4002, 8217, 9000, 9001, 42161, 42170, 42220, 42262, 43113, 43114, 44787, 71401, 71402, 80001, 421611, 421613, 11155111,
  1313161554, 1666600000,
];
