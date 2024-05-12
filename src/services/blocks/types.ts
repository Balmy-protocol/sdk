import { BlockNumber } from 'viem';
import { ChainId, TimeString, Timestamp } from '@types';

export type BlockResult = { block: BlockNumber; timestamp: Timestamp };

export type IBlocksService = {
  supportedChains(): ChainId[];
  getBlockClosestToTimestampInChain(_: { chainId: ChainId; timestamp: Timestamp; config?: { timeout?: TimeString } }): Promise<BlockResult>;
  getBlocksClosestToTimestampsInChain(_: {
    chainId: ChainId;
    timestamps: Timestamp[];
    config?: { timeout?: TimeString };
  }): Promise<Record<Timestamp, BlockResult>>;
  getBlocksClosestToTimestamps(_: {
    timestamps: BlockInput[];
    config?: { timeout?: TimeString };
  }): Promise<Record<ChainId, Record<Timestamp, BlockResult>>>;
};

export type IBlocksSource = {
  supportedChains(): ChainId[];
  getBlocksClosestToTimestamps(_: {
    timestamps: BlockInput[];
    config?: { timeout?: TimeString };
  }): Promise<Record<ChainId, Record<Timestamp, BlockResult>>>;
};

export type BlockInput = {
  chainId: ChainId;
  timestamp: Timestamp;
};
