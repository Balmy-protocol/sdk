import { ExpirationConfigOptions } from '@shared/generic-cache';
import { IFetchService } from '@services/fetch/types';
import { IMulticallService } from '@services/multicall/types';
import { DefiLlamaMetadataSource } from '@services/metadata/metadata-sources/defi-llama';
import { ExtractMetadata, IMetadataService, IMetadataSource } from '@services/metadata/types';
import { MetadataService } from '@services/metadata/metadata-service';
import { RPCMetadataSource } from '@services/metadata/metadata-sources/rpc-metadata-source';
import { CachedMetadataSource } from '@services/metadata/metadata-sources/cached-metadata-source';
import { FallbackMetadataSource } from '@services/metadata/metadata-sources/fallback-metadata-source';

export type MetadataSourceInput =
  | { type: 'defi-llama' }
  | { type: 'rpc-multicall' }
  | { type: 'cached'; underlyingSource: MetadataSourceInput; expiration: ExpirationConfigOptions }
  | { type: 'custom'; instance: IMetadataSource<object> }
  | { type: 'combine-when-possible'; sources: MetadataSourceInput[] };

export type BuildMetadataParams = { source: MetadataSourceInput };
export type CalculateMetadataFromSourceParams<Params extends BuildMetadataParams | undefined> = ExtractMetadata<
  CalculateSourceFromParams<Params>
>;

type CalculateSourceFromParams<T extends BuildMetadataParams | undefined> = T extends BuildMetadataParams
  ? CalculateSourceFromInput<T['source']>
  : CalculateSourceFromInput<undefined>;

type CalculateSourceFromInput<Input extends MetadataSourceInput | undefined> = undefined extends Input
  ? FallbackMetadataSource<[DefiLlamaMetadataSource, RPCMetadataSource]>
  : Input extends { type: 'defi-llama' }
  ? DefiLlamaMetadataSource
  : Input extends { type: 'rpc-multicall' }
  ? RPCMetadataSource
  : Input extends { type: 'custom' }
  ? Input['instance']
  : Input extends { type: 'combine-when-possible' }
  ? FallbackMetadataSource<SourcesFromArray<Input['sources']>>
  : never;

type SourcesFromArray<Inputs extends MetadataSourceInput[]> = Inputs extends MetadataSourceInput[]
  ? { [K in keyof Inputs]: Inputs[K] extends MetadataSourceInput ? CalculateSourceFromInput<Inputs[K]> : Inputs[K] }
  : Inputs;

export function buildMetadataService<T extends BuildMetadataParams | undefined>(
  params: T,
  fetchService: IFetchService,
  multicallService: IMulticallService
): IMetadataService<CalculateMetadataFromSourceParams<T>> {
  const source = buildSource(params?.source, { fetchService, multicallService }) as IMetadataSource<CalculateMetadataFromSourceParams<T>>;
  return new MetadataService(source);
}

function buildSource<T extends MetadataSourceInput>(
  source: T | undefined,
  { fetchService, multicallService }: { fetchService: IFetchService; multicallService: IMulticallService }
): IMetadataSource<object> {
  switch (source?.type) {
    case undefined:
      const defiLlama = new DefiLlamaMetadataSource(fetchService);
      const rpc = new RPCMetadataSource(multicallService);
      return new FallbackMetadataSource([defiLlama, rpc]);
    case 'defi-llama':
      return new DefiLlamaMetadataSource(fetchService);
    case 'cached':
      const underlying = buildSource(source.underlyingSource, { fetchService, multicallService });
      return new CachedMetadataSource(underlying, source.expiration);
    case 'rpc-multicall':
      return new RPCMetadataSource(multicallService);
    case 'custom':
      return source.instance;
    case 'combine-when-possible':
      return new FallbackMetadataSource(source.sources.map((source) => buildSource(source, { fetchService, multicallService })));
  }
}
