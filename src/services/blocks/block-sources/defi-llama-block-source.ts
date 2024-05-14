import { ChainId, Timestamp } from '@types';
import { IFetchService } from '@services/fetch';
import { DefiLlamaClient } from '@shared/defi-llama';
import { BlockResult, IBlocksSource } from '../types';
import { IProviderService } from '@services/providers';

export class DefiLlamaBlockSource implements IBlocksSource {
  private readonly defiLlama: DefiLlamaClient;
  private readonly providerService: IProviderService;

  constructor(fetch: IFetchService, providerService: IProviderService) {
    this.defiLlama = new DefiLlamaClient(fetch);
    this.providerService = providerService;
  }

  supportedChains(): ChainId[] {
    return this.defiLlama.supportedChains();
  }

  async getBlocksClosestToTimestamps({
    timestamps,
  }: {
    timestamps: { chainId: ChainId; timestamp: Timestamp }[];
  }): Promise<Record<ChainId, Record<Timestamp, BlockResult>>> {
    const result: Record<ChainId, Record<Timestamp, BlockResult>> = {};
    const promises: Promise<any>[] = [];
    for (const { chainId, timestamp } of timestamps) {
      if (!(chainId in result)) result[chainId] = {};
      const promise = this.defiLlama
        .getClosestBlock(chainId, timestamp)
        .then((block) => (result[chainId][timestamp] = block))
        .catch(async (e) => {
          const provider = this.providerService.getViemPublicClient({ chainId });

          // We're getting a timestamp value of 0n for genesis block, so we will use block 1n for now
          const blockOne = await provider.getBlock({ blockNumber: 1n });
          const blockTimestamp = Number(blockOne.timestamp);
          if (timestamp < blockTimestamp) {
            result[chainId][timestamp] = { block: 1n, timestamp: blockTimestamp };
          } else {
            throw e;
          }
        });
      promises.push(promise);
    }
    await Promise.all(promises);
    return result;
  }
}
