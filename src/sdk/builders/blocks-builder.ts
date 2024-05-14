import { IFetchService } from '@services/fetch';
import { IBlocksService, IBlocksSource } from '@services/blocks';
import { DefiLlamaBlockSource } from '@services/blocks/block-sources/defi-llama-block-source';
import { BlocksService } from '@services/blocks/block-service';
import { IProviderService } from '@services/providers';

export type BlocksSourceInput = { type: 'custom'; instance: IBlocksSource } | { type: 'defi-llama' };
export type BuildBlocksParams = { source: BlocksSourceInput };

export function buildBlocksService(
  params: BuildBlocksParams | undefined,
  fetchService: IFetchService,
  providerService: IProviderService
): IBlocksService {
  const source = buildSource(params?.source, { fetchService, providerService });
  return new BlocksService(source);
}

function buildSource(
  source: BlocksSourceInput | undefined,
  { fetchService, providerService }: { fetchService: IFetchService; providerService: IProviderService }
): IBlocksSource {
  switch (source?.type) {
    case undefined:
    case 'defi-llama':
      return new DefiLlamaBlockSource(fetchService, providerService);
    case 'custom':
      return source.instance;
  }
}
