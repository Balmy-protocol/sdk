import { providers } from 'ethers';
import { ChainId } from '@types';
import { ArrayTwoOrMore } from '@utility-types';
import { IProviderSource } from '@services/providers/types';
import { SingleProviderSource } from '@services/providers/provider-sources/single-provider';
import { AlchemyProviderSource } from '@services/providers/provider-sources/alchemy-provider';
import { PublicProvidersSource } from '@services/providers/provider-sources/public-providers';
import { FallbackSource } from '@services/providers/provider-sources/fallback-provider ';
import { PrioritizedProviderSourceCombinator } from '@services/providers/provider-sources/prioritized-provider-source-combinator';

export type BuildProviderParams = { source: ProviderSource } | { sources: ArrayTwoOrMore<ProviderSource>; calculation?: ProviderCalculation };
type ProviderSource =
  | providers.BaseProvider
  | 'public-rpcs'
  | { custom: IProviderSource }
  | { alchemy: { key: string; supportedChains?: ChainId[] } };
type ProviderCalculation = 'only-first-possible-provider-on-list' | 'combine-when-possible';

export function buildProviderSource(params?: BuildProviderParams) {
  let source: IProviderSource;
  if (!params) {
    source = new PublicProvidersSource();
  } else if ('source' in params) {
    source = getProviderSourceForConfig(params.source);
  } else {
    const sources = params.sources.map(getProviderSourceForConfig) as ArrayTwoOrMore<IProviderSource>;
    switch (params.calculation) {
      case 'only-first-possible-provider-on-list':
        source = new PrioritizedProviderSourceCombinator(sources);
        break;
      case 'combine-when-possible':
      default:
        source = new FallbackSource(sources);
        break;
    }
  }
  return source;
}

function getProviderSourceForConfig(source: ProviderSource) {
  if (source === 'public-rpcs') {
    return new PublicProvidersSource();
  } else if ('custom' in source) {
    return source.custom;
  } else if ('alchemy' in source) {
    return new AlchemyProviderSource(source.alchemy.key, source.alchemy.supportedChains);
  } else {
    return new SingleProviderSource(source);
  }
}
