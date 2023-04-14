import { AbiCoder } from 'ethers/lib/utils';
import { Contract } from 'ethers';
import { Address, ChainId } from '@types';
import { IProviderService } from '@services/providers/types';
import { IMulticallService } from './types';
import { chainsIntersection } from '@chains';
import abi from './multicall-abi';

const ADDRESS = '0xcA11bde05977b3631167028862bE2a173976CA11';
const ABI_CODER = new AbiCoder();
export class MulticallService implements IMulticallService {
  constructor(private readonly providerService: IProviderService, private readonly library: 'viem' | 'ethers' = 'ethers') {}

  supportedChains(): ChainId[] {
    return chainsIntersection(this.providerService.supportedChains(), SUPPORTED_CHAINS);
  }

  async readOnlyMulticall(args: {
    chainId: ChainId;
    calls: { target: Address; calldata: string; decode: string[] }[];
  }): Promise<ReadonlyArray<any>[]> {
    if (args.calls.length === 0) return [];
    return this.library === 'viem'
      ? readOnlyMulticallWithViem({ ...args, providerService: this.providerService })
      : readOnlyMulticallWithEthers({ ...args, providerService: this.providerService });
  }

  async tryReadOnlyMulticall(args: { chainId: ChainId; calls: { target: Address; calldata: string; decode: string[] }[] }) {
    if (args.calls.length === 0) return [];
    return this.library === 'viem'
      ? tryReadOnlyMulticallWithViem({ ...args, providerService: this.providerService })
      : tryReadOnlyMulticallWithEthers({ ...args, providerService: this.providerService });
  }
}

async function readOnlyMulticallWithViem({
  chainId,
  calls,
  providerService,
}: {
  chainId: ChainId;
  calls: { target: Address; calldata: string; decode: string[] }[];
  providerService: IProviderService;
}): Promise<ReadonlyArray<any>[]> {
  const simulation = await providerService.getViemClient({ chainId }).simulateContract({
    address: ADDRESS,
    abi,
    functionName: 'aggregate',
    args: [calls.map(({ target, calldata }) => [target, calldata])],
    blockTag: 'latest',
  });
  return (simulation.result as [number, string[]])[1].map((result, i) => ABI_CODER.decode(calls[i].decode, result));
}

async function readOnlyMulticallWithEthers({
  chainId,
  calls,
  providerService,
}: {
  chainId: ChainId;
  calls: { target: Address; calldata: string; decode: string[] }[];
  providerService: IProviderService;
}): Promise<ReadonlyArray<any>[]> {
  const provider = providerService.getEthersProvider({ chainId });
  const contract = new Contract(ADDRESS, abi, provider);
  const [blockNumber, results]: [number, string[]] = await contract.callStatic.aggregate(
    calls.map(({ target, calldata }) => [target, calldata])
  );
  return results.map((result, i) => ABI_CODER.decode(calls[i].decode, result));
}

async function tryReadOnlyMulticallWithViem({
  chainId,
  calls,
  providerService,
}: {
  chainId: ChainId;
  calls: { target: Address; calldata: string; decode: string[] }[];
  providerService: IProviderService;
}) {
  const simulation = await providerService.getViemClient({ chainId }).simulateContract({
    address: ADDRESS,
    abi,
    functionName: 'tryAggregate',
    args: [false, calls.map(({ target, calldata }) => [target, calldata])],
    blockTag: 'latest',
  });
  return (simulation.result as { success: boolean; returnData: string }[]).map(({ success, returnData }, i) =>
    success ? { success, result: ABI_CODER.decode(calls[i].decode, returnData) } : { success }
  );
}

async function tryReadOnlyMulticallWithEthers({
  chainId,
  calls,
  providerService,
}: {
  chainId: ChainId;
  calls: { target: Address; calldata: string; decode: string[] }[];
  providerService: IProviderService;
}) {
  const provider = providerService.getEthersProvider({ chainId });
  const contract = new Contract(ADDRESS, abi, provider);
  const results: [boolean, string][] = await contract.callStatic.tryAggregate(
    false,
    calls.map(({ target, calldata }) => [target, calldata])
  );
  return results.map(([success, result], i) => (success ? { success, result: ABI_CODER.decode(calls[i].decode, result) } : { success }));
}

const SUPPORTED_CHAINS: ChainId[] = [
  1, 3, 4, 5, 10, 14, 16, 18, 19, 25, 30, 31, 40, 42, 56, 66, 69, 97, 100, 106, 108, 114, 122, 128, 137, 250, 288, 321, 420, 592, 1088, 1284,
  1285, 1287, 2001, 4002, 8217, 9000, 9001, 42161, 42170, 42220, 42262, 43113, 43114, 44787, 71401, 71402, 80001, 421611, 421613, 11155111,
  1313161554, 1666600000,
];
