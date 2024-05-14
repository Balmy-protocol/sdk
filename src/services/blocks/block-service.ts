import { StringValue } from 'ms';
import { ChainId, TimeString, Timestamp } from '@types';
import { timeoutPromise } from '@shared/timeouts';
import { BlockInput, IBlocksService, IBlocksSource } from './types';

export class BlocksService implements IBlocksService {
  constructor(private readonly source: IBlocksSource) {}

  supportedChains(): ChainId[] {
    return this.source.supportedChains();
  }

  async getBlockClosestToTimestampInChain({
    chainId,
    timestamp,
    config,
  }: {
    chainId: ChainId;
    timestamp: Timestamp;
    config?: { timeout?: TimeString };
  }) {
    const result = await this.getBlocksClosestToTimestampsInChain({ chainId, timestamps: [timestamp], config });
    return result[timestamp];
  }

  async getBlocksClosestToTimestampsInChain({
    chainId,
    timestamps,
    config,
  }: {
    chainId: ChainId;
    timestamps: Timestamp[];
    config?: { timeout?: StringValue };
  }) {
    const result = await this.getBlocksClosestToTimestamps({ timestamps: timestamps.map((timestamp) => ({ chainId, timestamp })), config });
    return result[chainId];
  }

  async getBlocksClosestToTimestamps({ timestamps, config }: { timestamps: BlockInput[]; config?: { timeout?: TimeString } }) {
    if (timestamps.length === 0) return {};
    return timeoutPromise(this.source.getBlocksClosestToTimestamps({ timestamps, config }), config?.timeout);
  }
}
