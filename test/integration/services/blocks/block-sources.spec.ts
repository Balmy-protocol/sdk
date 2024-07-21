import ms from 'ms';
import chai, { expect } from 'chai';
import { Chains, getChainByKey } from '@chains';
import { ChainId, Timestamp } from '@types';
import chaiAsPromised from 'chai-as-promised';
import dotenv from 'dotenv';
import { FetchService } from '@services/fetch/fetch-service';
import { DefiLlamaBlockSource } from '@services/blocks/block-sources/defi-llama-block-source';
import { BlockResult, IBlocksSource } from '@services/blocks';
import { ProviderService } from '@services/providers/provider-service';
import { PublicRPCsProviderSource } from '@services/providers/provider-sources/public-rpcs-provider';
dotenv.config();
chai.use(chaiAsPromised);

const TESTS: Record<ChainId, Timestamp> = {
  [Chains.OPTIMISM.chainId]: 1672531200, // Sunday, January 1, 2023 12:00:00 AM
  [Chains.POLYGON.chainId]: 1651363200, // Sunday, May 1, 2022 12:00:00 AM
};

const PROVIDER_SERVICE = new ProviderService(new PublicRPCsProviderSource({ config: { type: 'fallback' } }));
const FETCH_SERVICE = new FetchService();
const DEFI_LLAMA_BLOCKS_SOURCE = new DefiLlamaBlockSource(FETCH_SERVICE, PROVIDER_SERVICE);

jest.retryTimes(2);
jest.setTimeout(ms('1m'));

describe('Blocks Sources', () => {
  blocksSourceTest({ title: 'Defi Llama Source', source: DEFI_LLAMA_BLOCKS_SOURCE });

  function blocksSourceTest({ title, source }: { title: string; source: IBlocksSource }) {
    describe(title, () => {
      describe('getBlocksClosestToTimestamps', () => {
        let result: Record<ChainId, Record<Timestamp, BlockResult>>;
        beforeAll(async () => {
          const timestamps = Object.entries(TESTS).map(([chainId, timestamp]) => ({ chainId: Number(chainId), timestamp }));
          result = await source.getBlocksClosestToTimestamps({ timestamps });
        });

        for (const chainId in TESTS) {
          const chain = getChainByKey(chainId);
          test(chain?.name ?? `Chain with id ${chainId}`, async () => {
            const timestamp = TESTS[chainId];
            const blockResult = result[chainId][timestamp];
            const viemClient = PROVIDER_SERVICE.getViemPublicClient({ chainId: Number(chainId) });
            const [before, block, after] = await Promise.all([
              viemClient.getBlock({ blockNumber: blockResult.block - 1n }),
              viemClient.getBlock({ blockNumber: blockResult.block }),
              viemClient.getBlock({ blockNumber: blockResult.block + 1n }),
            ]);
            const timestampDiffBefore = Math.abs(Number(before.timestamp) - timestamp);
            const timestampDiff = Math.abs(Number(block.timestamp) - timestamp);
            const timestampDiffAfter = Math.abs(Number(after.timestamp) - timestamp);
            expect(timestampDiff).to.be.lte(timestampDiffBefore);
            expect(timestampDiff).to.be.lte(timestampDiffAfter);
            expect(blockResult.timestamp).to.be.equal(Number(block.timestamp));
          });
        }
      });
    });
  }
});
