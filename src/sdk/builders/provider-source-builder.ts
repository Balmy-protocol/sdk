import { providers } from 'ethers';
import { ChainId } from '@types';
import { ArrayOneOrMore, ArrayTwoOrMore } from '@utility-types';
import { IProviderSource } from '@services/providers/types';
import { SingleProviderSource } from '@services/providers/provider-sources/single-provider';
import { AlchemyProviderSource } from '@services/providers/provider-sources/alchemy-provider';
import { PublicProvidersSource } from '@services/providers/provider-sources/public-providers';
import { FallbackSource } from '@services/providers/provider-sources/fallback-provider ';
import { PrioritizedProviderSourceCombinator } from '@services/providers/provider-sources/prioritized-provider-source-combinator';
import { InfuraProviderSource } from '@services/providers/provider-sources/infura-provider';

export type BuildProviderParams = { source: ProviderSource };
type ProviderSource =
  | { type: 'ethers'; instance: providers.BaseProvider }
  | { type: 'custom'; instance: IProviderSource }
  | { type: 'public-rpcs'; rpcsPerChain?: Record<ChainId, ArrayOneOrMore<string>> }
  | { type: 'alchemy'; config: { key: string; supportedChains?: ChainId[] } }
  | { type: 'infura'; config: { key: string; supportedChains?: ChainId[] } }
  | { type: 'combine-when-possible'; sources: ArrayTwoOrMore<ProviderSource> }
  | { type: 'only-first-provider-that-supports-chain'; sources: ArrayTwoOrMore<ProviderSource> };

export function buildProviderSource(params?: BuildProviderParams) {
  return buildSource(params?.source);
}

function buildSource(source?: ProviderSource): IProviderSource {
  switch (source?.type) {
    case undefined:
      return new PublicProvidersSource();
    case 'ethers':
      return new SingleProviderSource(source.instance);
    case 'custom':
      return source.instance;
    case 'public-rpcs':
      return new PublicProvidersSource(source.rpcsPerChain);
    case 'alchemy':
      return new AlchemyProviderSource(source.config.key, source.config.supportedChains);
    case 'infura':
      return new InfuraProviderSource(source.config.key, source.config.supportedChains);
    case 'combine-when-possible':
      return new FallbackSource(source.sources.map(buildSource) as ArrayTwoOrMore<IProviderSource>);
    case 'only-first-provider-that-supports-chain':
      return new PrioritizedProviderSourceCombinator(source.sources.map(buildSource) as ArrayTwoOrMore<IProviderSource>);
  }
}
