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

type MoralisConfig = { onChains?: ChainId[]; site?: 'site1' | 'site2' } | { keys: Record<ChainId, string>; site?: 'site1' | 'site2' };

export class MoralisProviderSource extends BaseHttpProvider {
  private readonly keys: Record<ChainId, string>;
  private readonly supported: ChainId[];
  private readonly site: 'site1' | 'site2';

  constructor(config: MoralisConfig) {
    super();
    if ('keys' in config) {
      this.supported = Object.keys(config.keys).map(Number);
      this.keys = config.keys;
    } else {
      this.supported = config.onChains ?? moralisSupportedChains();
      this.keys = {};
    }
    this.site = config.site ?? 'site1';
  }

  supportedChains(): ChainId[] {
    return this.supported;
  }

  protected calculateUrl(chainId: ChainId): string {
    return buildMoralisRPCUrl({ chainId, apiKey: this.keys[chainId], site: this.site });
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
