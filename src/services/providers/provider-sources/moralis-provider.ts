import { Chains } from '@chains';
import { ChainId } from '@types';
import { BaseHttpProvider } from './base/base-http-provider';

const SUPPORTED_CHAINS: Record<ChainId, string> = {
  [Chains.ETHEREUM.chainId]: 'eth',
  [Chains.ETHEREUM_SEPOLIA.chainId]: 'sepolia',
  [Chains.POLYGON.chainId]: 'polygon',
  [Chains.BNB_CHAIN.chainId]: 'bsc',
  [Chains.ARBITRUM.chainId]: 'arbitrum',
  [Chains.BASE.chainId]: 'base',
  [Chains.OPTIMISM.chainId]: 'optimism',
  [Chains.LINEA.chainId]: 'linea',
  [Chains.AVALANCHE.chainId]: 'avalanche',
  [Chains.GNOSIS.chainId]: 'gnosis',
  [Chains.MOONBEAM.chainId]: 'moonbeam',
  [Chains.MOONRIVER.chainId]: 'moonriver',
  [Chains.BLAST.chainId]: 'blast',
  [Chains.MANTLE.chainId]: 'mantle',
  [Chains.POLYGON_ZKEVM.chainId]: 'polygon-zkevm',
};

export class MoralisProviderSource extends BaseHttpProvider {
  private readonly key: string | undefined;
  private readonly site: 'site1' | 'site2';
  private readonly supported: ChainId[];

  constructor({ key, onChains, site = 'site1' }: { key?: string; onChains?: ChainId[]; site: 'site1' | 'site2' }) {
    super();
    this.supported = onChains ?? moralisSupportedChains();
    this.key = key;
    this.site = site;
  }

  supportedChains(): ChainId[] {
    return this.supported;
  }

  protected calculateUrl(chainId: ChainId): string {
    return buildMoralisRPCUrl({ chainId, apiKey: this.key, site: this.site });
  }
}

export function buildMoralisRPCUrl({ chainId, apiKey, site = 'site1' }: { chainId: ChainId; apiKey?: string; site?: 'site1' | 'site2' }) {
  let url = `https://${site}.moralis-nodes.com/${SUPPORTED_CHAINS[chainId]}/`;
  if (apiKey) {
    url += `${apiKey}`;
  }
  return url;
}

export function moralisSupportedChains(): ChainId[] {
  return Object.keys(SUPPORTED_CHAINS).map(Number);
}
