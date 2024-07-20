import { getAllChains } from '@chains';
import { ChainId, Chain } from '@types';
import { HttpProviderSource } from './http-provider';
import { LoadBalanceProviderSource, LoadBalanceSourceConfig } from './load-balance-provider';

export class PublicRPCsSource extends LoadBalanceProviderSource {
  constructor(params?: { publicRPCs?: Record<ChainId, string[]>; config?: LoadBalanceSourceConfig }) {
    super(buildSources(calculateRPCs(params?.publicRPCs)), params?.config);
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
