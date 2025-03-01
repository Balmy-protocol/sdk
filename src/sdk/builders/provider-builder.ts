import { ChainId } from '@types';
import { IProviderSource } from '@services/providers/types';
import { HttpProviderConfig } from '@services/providers/provider-sources/base/base-http-provider';
import { PublicRPCsProviderSource, PublicRPCsProviderSourceConfig } from '@services/providers/provider-sources/public-rpcs-provider';
import { FallbackProviderSourceConfig, FallbackProviderSource } from '@services/providers/provider-sources/fallback-provider';
import { LoadBalanceProviderSource, LoadBalanceProviderSourceConfig } from '@services/providers/provider-sources/load-balance-provider';
import { PrioritizedProviderSourceCombinator } from '@services/providers/provider-sources/prioritized-provider-source-combinator';
import { InfuraProviderSource } from '@services/providers/provider-sources/infura-provider';
import { HttpProviderSource } from '@services/providers/provider-sources/http-provider';
import { LlamaNodesProviderSource } from '@services/providers/provider-sources/llama-nodes-provider';
import { WebSocketProviderSource } from '@services/providers/provider-sources/web-sockets-provider';
import { ProviderService, ProviderConfig } from '@services/providers/provider-service';
import { NodeRealProviderSource } from '@services/providers/provider-sources/node-real-provider';
import { GetBlockProviderSource } from '@services/providers/provider-sources/get-block-provider';
import { AnkrProviderSource } from '@services/providers/provider-sources/ankr-provider';
import { TenderlyProviderSource } from '@services/providers/provider-sources/tenderly-provider';
import { dRPCProviderSource } from '@services/providers/provider-sources/drpc-provider';
import { BlastProviderSource } from '@services/providers/provider-sources/blast-provider';
import { OnFinalityProviderSource } from '@services/providers/provider-sources/on-finality-provider';
import { OneRPCProviderSource } from '@services/providers/provider-sources/one-rpc-provider';
import { AlchemyProviderSource, AlchemySupportedChains } from '@services/providers/provider-sources/alchemy-provider';
import { MoralisProviderSource } from '@services/providers/provider-sources/moralis-provider';
import { ThirdWebProviderSource } from '@services/providers/provider-sources/third-web-provider';
export type { ProviderConfig } from '@services/providers/provider-service';

export type BuildProviderParams = { source: ProviderSourceInput; config?: ProviderConfig };
export type ProviderSourceInput =
  | { type: 'custom'; instance: IProviderSource }
  | { type: 'public-rpcs'; rpcsPerChain?: Record<ChainId, string[]>; config?: PublicRPCsProviderSourceConfig }
  | { type: 'infura'; key: string; onChains?: ChainId[]; config?: HttpProviderConfig }
  | { type: 'node-real'; key: string; onChains?: ChainId[]; config?: HttpProviderConfig }
  | { type: 'dRPC'; key: string; onChains?: ChainId[]; config?: HttpProviderConfig }
  | { type: 'alchemy'; key: string; onChains?: AlchemySupportedChains; config?: HttpProviderConfig }
  | { type: 'third-web'; onChains?: ChainId[]; config?: HttpProviderConfig }
  | { type: 'blast'; key?: string; onChains?: ChainId[]; config?: HttpProviderConfig }
  | ({ type: 'moralis'; site?: 'site1' | 'site2'; config?: HttpProviderConfig } & ({ onChains?: ChainId[] } | { keys: Record<ChainId, string> }))
  | { type: '1rpc'; key?: string; onChains?: ChainId[]; config?: HttpProviderConfig }
  | { type: 'get-block'; accessTokens: Record<ChainId, string>; config?: HttpProviderConfig }
  | { type: 'llama-nodes'; key?: string; onChains?: ChainId[]; config?: HttpProviderConfig }
  | { type: 'on-finality'; key?: string; onChains?: ChainId[]; config?: HttpProviderConfig }
  | { type: 'ankr'; key?: string; onChains?: ChainId[]; config?: HttpProviderConfig }
  | { type: 'tenderly'; key?: string; onChains?: ChainId[]; config?: HttpProviderConfig }
  | { type: 'http'; url: string; supportedChains: ChainId[]; config?: HttpProviderConfig }
  | { type: 'web-socket'; url: string; supportedChains: ChainId[] }
  | { type: 'fallback'; sources: ProviderSourceInput[]; config?: FallbackProviderSourceConfig }
  | { type: 'load-balance'; sources: ProviderSourceInput[]; config?: LoadBalanceProviderSourceConfig }
  | { type: 'prioritized'; sources: ProviderSourceInput[] };

export function buildProviderService(params?: BuildProviderParams) {
  const source = buildSource(params?.source);
  return new ProviderService({ source, config: params?.config });
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
      return new dRPCProviderSource(source);
    case 'third-web':
      return new ThirdWebProviderSource(source);
    case 'alchemy':
      return new AlchemyProviderSource(source);
    case 'blast':
      return new BlastProviderSource(source);
    case '1rpc':
      return new OneRPCProviderSource(source);
    case 'llama-nodes':
      return new LlamaNodesProviderSource(source);
    case 'ankr':
      return new AnkrProviderSource(source);
    case 'on-finality':
      return new OnFinalityProviderSource(source);
    case 'tenderly':
      return new TenderlyProviderSource(source);
    case 'infura':
      return new InfuraProviderSource(source);
    case 'node-real':
      return new NodeRealProviderSource(source);
    case 'get-block':
      return new GetBlockProviderSource(source);
    case 'http':
      return new HttpProviderSource({ url: source.url, chains: source.supportedChains, config: source.config });
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
