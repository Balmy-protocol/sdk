import { ChainId } from '@types';
import { IProviderSource } from '@services/providers/types';
import { PublicRPCsProviderSource, PublicRPCsProviderSourceConfig } from '@services/providers/provider-sources/public-rpcs-provider';
import { FallbackProviderSourceConfig, FallbackProviderSource } from '@services/providers/provider-sources/fallback-provider';
import { LoadBalanceProviderSource, LoadBalanceProviderSourceConfig } from '@services/providers/provider-sources/load-balance-provider';
import { PrioritizedProviderSourceCombinator } from '@services/providers/provider-sources/prioritized-provider-source-combinator';
import { InfuraProviderSource } from '@services/providers/provider-sources/infura-provider';
import { HttpProviderSource } from '@services/providers/provider-sources/http-provider';
import { LlamaNodesProviderSource } from '@services/providers/provider-sources/llama-nodes-provider';
import { WebSocketProviderSource } from '@services/providers/provider-sources/web-sockets-provider';
import { ProviderService } from '@services/providers/provider-service';
import { NodeRealProviderSource } from '@services/providers/provider-sources/node-real-provider';
import { GetBlockProviderSource } from '@services/providers/provider-sources/get-block-provider';
import { AnkrProviderSource } from '@services/providers/provider-sources/ankr-provider';
import { TenderlyProviderSource } from '@services/providers/provider-sources/tenderly-provider';
import { dRPCProviderSource } from '@services/providers/provider-sources/drpc-provider';
import { BlastProviderSource } from '@services/providers/provider-sources/blast-provider';
import { OnFinalityProviderSource } from '@services/providers/provider-sources/on-finality-provider';
import { OneRPCProviderSource } from '@services/providers/provider-sources/one-rpc-provider';
import { AlchemyProviderSource } from '@services/providers/provider-sources/alchemy-provider';
import { MoralisProviderSource } from '@services/providers/provider-sources/moralis-provider';
import { ThirdWebProviderSource } from '@services/providers/provider-sources/third-web-provider';

export type BuildProviderParams = { source: ProviderSourceInput };
export type ProviderSourceInput =
  | { type: 'custom'; instance: IProviderSource }
  | { type: 'public-rpcs'; rpcsPerChain?: Record<ChainId, string[]>; config?: PublicRPCsProviderSourceConfig }
  | { type: 'infura'; key: string; onChains?: ChainId[] }
  | { type: 'node-real'; key: string; onChains?: ChainId[] }
  | { type: 'dRPC'; key: string; onChains?: ChainId[] }
  | { type: 'alchemy'; key: string; onChains?: ChainId[] }
  | { type: 'third-web'; onChains?: ChainId[] }
  | { type: 'blast'; key?: string; onChains?: ChainId[] }
  | ({ type: 'moralis'; site?: 'site1' | 'site2' } & ({ onChains?: ChainId[] } | { keys: Record<ChainId, string> }))
  | { type: '1rpc'; key?: string; onChains?: ChainId[] }
  | { type: 'get-block'; accessTokens: Record<ChainId, string> }
  | { type: 'llama-nodes'; key?: string; onChains?: ChainId[] }
  | { type: 'on-finality'; key?: string; onChains?: ChainId[] }
  | { type: 'ankr'; key?: string; onChains?: ChainId[] }
  | { type: 'tenderly'; key?: string; onChains?: ChainId[] }
  | { type: 'http'; url: string; supportedChains: ChainId[] }
  | { type: 'web-socket'; url: string; supportedChains: ChainId[] }
  | { type: 'fallback'; sources: ProviderSourceInput[]; config?: FallbackProviderSourceConfig }
  | { type: 'load-balance'; sources: ProviderSourceInput[]; config?: LoadBalanceProviderSourceConfig }
  | { type: 'prioritized'; sources: ProviderSourceInput[] };

export function buildProviderService(params?: BuildProviderParams) {
  const source = buildSource(params?.source);
  return new ProviderService(source);
}

function buildSource(source?: ProviderSourceInput): IProviderSource {
  switch (source?.type) {
    case undefined:
      return new PublicRPCsProviderSource();
    case 'custom':
      return source.instance;
    case 'public-rpcs':
      return new PublicRPCsProviderSource({ publicRPCs: source.rpcsPerChain, config: source.config });
    case 'moralis':
      return new MoralisProviderSource(source);
    case 'dRPC':
      return new dRPCProviderSource(source.key, source.onChains);
    case 'third-web':
      return new ThirdWebProviderSource(source.onChains);
    case 'alchemy':
      return new AlchemyProviderSource(source.key, source.onChains);
    case 'blast':
      return new BlastProviderSource(source.key, source.onChains);
    case '1rpc':
      return new OneRPCProviderSource(source.key, source.onChains);
    case 'llama-nodes':
      return new LlamaNodesProviderSource(source.key, source.onChains);
    case 'ankr':
      return new AnkrProviderSource(source.key, source.onChains);
    case 'on-finality':
      return new OnFinalityProviderSource(source.key, source.onChains);
    case 'tenderly':
      return new TenderlyProviderSource(source.key, source.onChains);
    case 'infura':
      return new InfuraProviderSource(source.key, source.onChains);
    case 'node-real':
      return new NodeRealProviderSource(source.key, source.onChains);
    case 'get-block':
      return new GetBlockProviderSource(source.accessTokens);
    case 'http':
      return new HttpProviderSource(source.url, source.supportedChains);
    case 'web-socket':
      return new WebSocketProviderSource(source.url, source.supportedChains);
    case 'fallback':
      return new FallbackProviderSource(source.sources.map(buildSource), source.config);
    case 'load-balance':
      return new LoadBalanceProviderSource(source.sources.map(buildSource), source.config);
    case 'prioritized':
      return new PrioritizedProviderSourceCombinator(source.sources.map(buildSource));
  }
}
