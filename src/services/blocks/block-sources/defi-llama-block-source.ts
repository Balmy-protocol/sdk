import { ChainId, Timestamp } from '@types';
import { IFetchService } from '@services/fetch';
import { DefiLlamaClient } from '@shared/defi-llama';
import { BlockInput, BlockResult, IBlocksSource } from '../types';

export class DefiLlamaBlockSource implements IBlocksSource {
  private readonly defiLlama: DefiLlamaClient;

  constructor(fetch: IFetchService) {
    this.defiLlama = new DefiLlamaClient(fetch);
  }

  supportedChains(): ChainId[] {
    return this.defiLlama.supportedChains();
  }

  async getBlocksClosestToTimestamps({ timestamps }: { timestamps: BlockInput[] }): Promise<Record<ChainId, Record<Timestamp, BlockResult>>> {
    const result: Record<ChainId, Record<Timestamp, BlockResult>> = {};
    const promises: Promise<any>[] = [];
    for (const { chainId, timestamp } of timestamps) {
      if (!(chainId in result)) result[chainId] = {};
      const promise = this.defiLlama.getClosestBlock(chainId, timestamp).then((block) => (result[chainId][timestamp] = block));
      promises.push(promise);
    }
    await Promise.all(promises);
    return result;
  }
}
