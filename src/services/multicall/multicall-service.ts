import { Address, ChainId } from '@types';
import { IProviderService } from '@services/providers/types';
import { IMulticallService, MulticallArgs } from './types';
import { chainsIntersection } from '@chains';
import {
  AbiDecodingZeroDataError,
  BaseError,
  EncodeFunctionDataParameters,
  Hex,
  MulticallResult,
  RawContractError,
  Address as ViemAddress,
  decodeFunctionResult,
  encodeFunctionData,
  getContractError,
  parseAbi,
} from 'viem';
import { Contract } from 'alchemy-sdk';

const ADDRESS = '0xcA11bde05977b3631167028862bE2a173976CA11';
export class MulticallService implements IMulticallService {
  constructor(private readonly providerService: IProviderService, private readonly client: 'ethers' | 'viem' = 'viem') {}

  supportedChains(): ChainId[] {
    return chainsIntersection(this.providerService.supportedChains(), SUPPORTED_CHAINS);
  }

  async readOnlyMulticall<T>(args: MulticallArgs): Promise<T[]> {
    if (args.calls.length === 0) return [];
    return this.multicall({ ...args, allowFailure: false }) as Promise<T[]>;
  }

  async tryReadOnlyMulticall<T>(args: MulticallArgs) {
    if (args.calls.length === 0) return [];
    const results = await this.multicall({ ...args, allowFailure: true });
    return results.map(({ error, status, result }) =>
      status === 'success' ? { status, result: result as T } : { status, error: error.message }
    );
  }

  private async multicall<TAllowFailure extends boolean>(args: MulticallArgs & { allowFailure: TAllowFailure }) {
    const viemSupported = this.providerService.supportedClients()[args.chainId]?.viem;
    return viemSupported && this.client === 'viem' ? this.viemMulticall(args) : this.ethersMulticall(args);
  }

  private async viemMulticall<TAllowFailure extends boolean>({
    chainId,
    calls,
    at,
    allowFailure,
    batching,
  }: MulticallArgs & { allowFailure: TAllowFailure }) {
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

  private async ethersMulticall<TAllowFailure extends boolean>({
    chainId,
    calls,
    at,
    allowFailure,
    batching,
  }: MulticallArgs & { allowFailure: TAllowFailure }) {
    const batchSize = batching?.maxSizeInBytes ?? Infinity;
    const blockNumber = at?.block?.number ? BigInt(at.block.number) : undefined;

    type Aggregate3Calls = {
      allowFailure: boolean;
      callData: string;
      target: Address;
    }[];

    const chunkedCalls: Aggregate3Calls[] = [[]];
    let currentChunk = 0;
    let currentChunkSize = 0;
    for (let i = 0; i < calls.length; i++) {
      const { abi, address, args, functionName } = calls[i];
      const jsonAbi = 'humanReadable' in abi ? parseAbi(abi.humanReadable) : abi.json;
      try {
        const callData = encodeFunctionData({
          abi: jsonAbi,
          args,
          functionName,
        } as unknown as EncodeFunctionDataParameters);

        currentChunkSize += callData.length;
        if (batchSize > 0 && currentChunkSize > batchSize) {
          currentChunk++;
          currentChunkSize = (callData.length - 2) / 2;
          chunkedCalls[currentChunk] = [];
        }

        chunkedCalls[currentChunk] = [
          ...chunkedCalls[currentChunk],
          {
            allowFailure: true,
            callData,
            target: address,
          },
        ];
      } catch (err) {
        const error = getContractError(err as BaseError, {
          abi: jsonAbi,
          address: address as ViemAddress,
          args,
          docsPath: '/docs/contract/multicall',
          functionName,
        });
        if (!allowFailure) throw error;
        chunkedCalls[currentChunk] = [
          ...chunkedCalls[currentChunk],
          {
            allowFailure: true,
            callData: '0x',
            target: address,
          },
        ];
      }
    }

    const provider = this.providerService.getEthersProvider({ chainId });
    const contract = new Contract(ADDRESS, SMALL_ABI, provider);

    const results = await Promise.all(
      chunkedCalls.map((calls) =>
        contract.callStatic
          .aggregate3(calls, { blockTag: blockNumber })
          .then((results: [boolean, string][]) => results.map(([success, returnData]) => ({ success, returnData })))
      )
    );

    return results.flat().map(({ returnData, success }, i) => {
      const flatennedCalls = chunkedCalls.flat();
      const { callData } = flatennedCalls[i];
      const { abi, address, functionName, args } = calls[i];
      const jsonAbi = 'humanReadable' in abi ? parseAbi(abi.humanReadable) : abi.json;
      try {
        if (callData === '0x') throw new AbiDecodingZeroDataError();
        if (!success) throw new RawContractError({ data: returnData as Hex });
        const result = decodeFunctionResult({
          abi: jsonAbi,
          args,
          data: returnData as Hex,
          functionName: functionName,
        });
        return allowFailure ? { result, status: 'success' } : result;
      } catch (err) {
        const error = getContractError(err as BaseError, {
          abi: jsonAbi,
          address: address as ViemAddress,
          args,
          docsPath: '/docs/contract/multicall',
          functionName,
        });
        if (!allowFailure) throw error;
        return { error, result: undefined, status: 'failure' };
      }
    }) as MulticallResult<unknown, TAllowFailure>[];
  }
}

const SUPPORTED_CHAINS: ChainId[] = [
  1, 3, 4, 5, 10, 14, 16, 18, 19, 25, 30, 31, 40, 42, 56, 66, 69, 97, 100, 106, 108, 114, 122, 128, 137, 250, 288, 321, 420, 592, 1088, 1284,
  1285, 1287, 2001, 4002, 8217, 8453, 9000, 9001, 42161, 42170, 42220, 42262, 43113, 43114, 44787, 59144, 71401, 71402, 80001, 84531, 421611,
  421613, 11155111, 1313161554, 1666600000,
];

const SMALL_ABI = [
  'function aggregate3(tuple(address target, bool allowFailure, bytes callData)[] calls) payable returns (tuple(bool success, bytes returnData)[] returnData)',
];
