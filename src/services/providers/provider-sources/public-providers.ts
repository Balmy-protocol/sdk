import { getAllChains } from '@chains';
import { ChainId, Chain } from '@types';
import { HttpProviderSource } from './http-provider';
import { FallbackSource } from './fallback-provider';

export class PublicRPCsSource extends FallbackSource {
  constructor(publicRPCs?: Record<ChainId, string[]>) {
    super(buildSources(calculateRPCs(publicRPCs)), { ethers: { quorum: 1 }, viem: { rank: false } });
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
