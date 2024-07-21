import { Transport } from 'viem';
import { getAllChains } from '@chains';
import { ChainId, Chain } from '@types';
import { HttpProviderSource } from './http-provider';
import { LoadBalanceProviderSource, LoadBalanceProviderSourceConfig } from './load-balance-provider';
import { FallbackProviderSource, FallbackProviderSourceConfig } from './fallback-provider';
import { IProviderSource } from '../types';

export type PublicRPCsProviderSourceConfig =
  | { type: 'load-balance'; config?: LoadBalanceProviderSourceConfig }
  | { type: 'fallback'; config?: FallbackProviderSourceConfig };

export class PublicRPCsProviderSource implements IProviderSource {
  private readonly source: IProviderSource;

  constructor(params?: { publicRPCs?: Record<ChainId, string[]>; config?: PublicRPCsProviderSourceConfig }) {
    const sources = buildSources(calculateRPCs(params?.publicRPCs));
    this.source =
      params?.config?.type === 'fallback'
        ? new FallbackProviderSource(sources, params.config.config)
        : new LoadBalanceProviderSource(sources, params?.config?.config);
  }

  supportedChains(): ChainId[] {
    return this.source.supportedChains();
  }

  getViemTransport({ chainId }: { chainId: ChainId }): Transport {
    return this.source.getViemTransport({ chainId });
  }
}

function buildSources(publicRPCs: { chainId: ChainId; publicRPC: string }[]) {
  return publicRPCs.map(({ chainId, publicRPC }) => new HttpProviderSource(publicRPC, [chainId]));
}

function calculateRPCs(publicRPCs?: Record<ChainId, string[]>): { chainId: ChainId; publicRPC: string }[] {
  const rpcsByChain: [ChainId, string[]][] = publicRPCs
    ? Object.entries(publicRPCs).map(([chainId, rpcs]) => [Number(chainId), rpcs])
    : getAllChains()
        .filter((chain): chain is Chain & { publicRPCs: string[] } => chain.publicRPCs.length > 0)
        .map(({ chainId, publicRPCs }) => [chainId, publicRPCs]);
  return rpcsByChain.flatMap(([chainId, publicRPCs]) => publicRPCs.map((publicRPC) => ({ publicRPC, chainId: Number(chainId) })));
}
