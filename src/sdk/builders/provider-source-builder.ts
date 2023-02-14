import { providers } from 'ethers';
import { ChainId } from '@types';
import { ArrayOneOrMore, ArrayTwoOrMore } from '@utility-types';
import { IProviderSource } from '@services/providers/types';
import { EthersProviderSource } from '@services/providers/provider-sources/ethers-provider';
import { AlchemyProviderSource } from '@services/providers/provider-sources/alchemy-provider';
import { PublicRPCsSource } from '@services/providers/provider-sources/public-providers';
import { FallbackSource } from '@services/providers/provider-sources/fallback-provider ';
import { PrioritizedProviderSourceCombinator } from '@services/providers/provider-sources/prioritized-provider-source-combinator';
import { InfuraProviderSource } from '@services/providers/provider-sources/infura-provider';
import { JsonRPCProviderSource } from '@services/providers/provider-sources/json-rpc-provider';
import { LlamaNodesProviderSource } from '@services/providers/provider-sources/llama-nodes-provider';

export type BuildProviderParams = { source: ProviderSourceInput };
export type ProviderSourceInput =
  | { type: 'ethers'; instance: providers.BaseProvider }
  | { type: 'custom'; instance: IProviderSource }
  | { type: 'public-rpcs'; rpcsPerChain?: Record<ChainId, ArrayOneOrMore<string>> }
  | { type: 'alchemy'; config: { key: string; supportedChains?: ChainId[] } }
  | { type: 'infura'; config: { key: string; supportedChains?: ChainId[] } }
  | { type: 'llama-nodes'; config: { key: string } }
  | { type: 'json-rpc'; config: { url: string; supportedChains: ArrayOneOrMore<ChainId> } }
  | { type: 'combine-when-possible'; sources: ProviderSourceInput[] }
  | { type: 'only-first-provider-that-supports-chain'; sources: ProviderSourceInput[] };

export function buildProviderSource(params?: BuildProviderParams) {
  return buildSource(params?.source);
}

function buildSource(source?: ProviderSourceInput): IProviderSource {
  switch (source?.type) {
    case undefined:
      return new PublicRPCsSource();
    case 'ethers':
      return new EthersProviderSource(source.instance);
    case 'custom':
      return source.instance;
    case 'public-rpcs':
      return new PublicRPCsSource(source.rpcsPerChain);
    case 'alchemy':
      return new AlchemyProviderSource(source.config.key, source.config.supportedChains);
    case 'llama-nodes':
      return new LlamaNodesProviderSource(source.config.key);
    case 'infura':
      return new InfuraProviderSource(source.config.key, source.config.supportedChains);
    case 'json-rpc':
      return new JsonRPCProviderSource(source.config.url, source.config.supportedChains);
    case 'combine-when-possible':
      return new FallbackSource(source.sources.map(buildSource) as ArrayTwoOrMore<IProviderSource>);
    case 'only-first-provider-that-supports-chain':
      return new PrioritizedProviderSourceCombinator(source.sources.map(buildSource) as ArrayTwoOrMore<IProviderSource>);
  }
}
