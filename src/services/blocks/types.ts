import { BlockNumber } from 'viem';
import { ChainId, Timestamp } from '@types';

export type BlockResult = { block: BlockNumber; timestamp: Timestamp };

export type IBlocksService = {
  supportedChains(): ChainId[];
  getBlockClosestToTimestamp(_: { chainId: ChainId; timestamp: Timestamp }): Promise<BlockResult>;
  getBlocksClosestToTimestamps(_: {
    timestamps: { chainId: ChainId; timestamp: Timestamp }[];
  }): Promise<Record<ChainId, Record<Timestamp, BlockResult>>>;
};

export type IBlocksSource = {
  supportedChains(): ChainId[];
  getBlocksClosestToTimestamps(_: {
    timestamps: { chainId: ChainId; timestamp: Timestamp }[];
  }): Promise<Record<ChainId, Record<Timestamp, BlockResult>>>;
};
