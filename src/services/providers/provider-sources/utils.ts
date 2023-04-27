import { ChainId } from '@types';
import { IProviderSource, ProviderClientSupport } from '../types';

export function combineClientSupport(sources: IProviderSource[]): Record<ChainId, ProviderClientSupport> {
  const result: Record<ChainId, ProviderClientSupport> = {};
  for (const source of sources) {
    for (const [chainIdString, support] of Object.entries(source.supportedClients())) {
      const chainId = Number(chainIdString);
      const current = result[chainId] ?? { ethers: false, viem: false };
      result[chainId] = {
        ethers: current.ethers || support.ethers,
        viem: current.viem || support.viem,
      };
    }
  }
  return result;
}

export function sourcesWithSupport(chainId: ChainId, sources: IProviderSource[], support: keyof ProviderClientSupport) {
  return sources.filter((source) => source.supportedClients()[chainId]?.[support]);
}
