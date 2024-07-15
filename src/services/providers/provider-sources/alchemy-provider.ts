import { ChainId } from '@types';
import { Chains } from '@chains';
import { BaseHttpProvider } from './base/base-http-provider';

const ALCHEMY_NETWORKS: Record<ChainId, string> = {
  [Chains.ETHEREUM.chainId]: 'eth-mainnet',
  [Chains.ETHEREUM_SEPOLIA.chainId]: 'eth-sepolia',
  [Chains.OPTIMISM.chainId]: 'opt-mainnet',
  // [Chains.OPTIMISM_SEPOLIA.chainId]: 'opt-sepolia',
  [Chains.ARBITRUM.chainId]: 'arb-mainnet',
  // [Chains.ARBITRUM_SEPOLIA.chainId]: 'arb-sepolia',
  [Chains.POLYGON.chainId]: 'polygon-mainnet',
  [Chains.POLYGON_MUMBAI.chainId]: 'polygon-mumbai',
  [Chains.ASTAR.chainId]: 'astar-mainnet',
  [Chains.BLAST.chainId]: 'blast-mainnet',
  [Chains.BNB_CHAIN.chainId]: 'bnb-mainnet',
  [Chains.AVALANCHE.chainId]: 'avax-mainnet',
  [Chains.METIS_ANDROMEDA.chainId]: 'metis-mainnet',
  [Chains.POLYGON_ZKEVM.chainId]: 'polygonzkevm-mainnet',
  // [Chains.POLYGON_ZKEVM_TESTNET.chainId]: 'polygonzkevm-testnet',
  [Chains.BASE.chainId]: 'base-mainnet',
  // [Chains.BASE_SEPOLIA.chainId]: 'base-sepolia',
  // [Chains.ZKSYNC.chainId]: 'zksync-mainnet',
  // [Chains.ZKSYNC_SEPOLIA.chainId]: 'zksync-sepolia',
};

export class AlchemyProviderSource extends BaseHttpProvider {
  private readonly supported: ChainId[];

  constructor(private readonly key: string, onChains?: ChainId[]) {
    super();
    this.supported = onChains ?? alchemySupportedChains();
  }

  supportedChains(): ChainId[] {
    return this.supported;
  }

  protected calculateUrl(chainId: ChainId): string {
    return buildAlchemyRPCUrl({ chainId, apiKey: this.key, protocol: 'https' });
  }
}

export function alchemySupportedChains(): ChainId[] {
  return Object.keys(ALCHEMY_NETWORKS).map(Number);
}

export function buildAlchemyRPCUrl({ chainId, apiKey, protocol }: { chainId: ChainId; apiKey: string; protocol: 'https' | 'wss' }) {
  const alchemyNetwork = ALCHEMY_NETWORKS[chainId];
  return `${protocol}://${alchemyNetwork}.g.alchemy.com/v2/${apiKey}`;
}
