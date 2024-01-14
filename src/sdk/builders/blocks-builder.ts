import { IFetchService } from '@services/fetch';
import { IBlocksService, IBlocksSource } from '@services/blocks';
import { DefiLlamaBlockSource } from '@services/blocks/block-sources/defi-llama-block-source';
import { BlocksService } from '@services/blocks/block-service';

export type BlocksSourceInput = { type: 'custom'; instance: IBlocksSource } | { type: 'defi-llama' };
export type BuildBlocksParams = { source: BlocksSourceInput };

export function buildBlocksService(params: BuildBlocksParams | undefined, fetchService: IFetchService): IBlocksService {
  const source = buildSource(params?.source, { fetchService });
  return new BlocksService(source);
}

function buildSource(source: BlocksSourceInput | undefined, { fetchService }: { fetchService: IFetchService }): IBlocksSource {
  switch (source?.type) {
    case undefined:
    case 'defi-llama':
      return new DefiLlamaBlockSource(fetchService);
    case 'custom':
      return source.instance;
  }
}
