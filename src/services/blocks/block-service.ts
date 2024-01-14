import { ChainId, Timestamp } from '@types';
import { BlockResult, IBlocksService, IBlocksSource } from './types';

export class BlocksService implements IBlocksService {
  constructor(private readonly source: IBlocksSource) {}

  supportedChains(): ChainId[] {
    return this.source.supportedChains();
  }

  async getBlockClosestToTimestamp({ chainId, timestamp }: { chainId: ChainId; timestamp: Timestamp }): Promise<BlockResult> {
    const result = await this.getBlocksClosestToTimestamps({ timestamps: [{ chainId, timestamp }] });
    return result[chainId][timestamp];
  }

  async getBlocksClosestToTimestamps(args: {
    timestamps: { chainId: ChainId; timestamp: Timestamp }[];
  }): Promise<Record<ChainId, Record<Timestamp, BlockResult>>> {
    if (args.timestamps.length === 0) return {};
    return this.source.getBlocksClosestToTimestamps(args);
  }
}
