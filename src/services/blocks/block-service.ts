import { ChainId } from '@types';
import { BlockResult, IBlocksService, IBlocksSource } from './types';

export class BlocksService implements IBlocksService {
  constructor(private readonly source: IBlocksSource) {}

  supportedChains(): ChainId[] {
    return this.source.supportedChains();
  }

  async getBlockClosestToTimestamp({ chainId, timestamp }: { chainId: number; timestamp: number }): Promise<BlockResult> {
    const result = await this.getBlocksClosestToTimestamps({ timestamps: [{ chainId, timestamp }] });
    return result[chainId][timestamp];
  }

  getBlocksClosestToTimestamps(args: {
    timestamps: { chainId: number; timestamp: number }[];
  }): Promise<Record<number, Record<number, BlockResult>>> {
    return this.source.getBlocksClosestToTimestamps(args);
  }
}
