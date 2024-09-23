import { ChainId } from '@types';
import { Chains } from '@chains';
import { BaseHttpProvider } from './base/base-http-provider';

const ALCHEMY_NETWORKS: Record<ChainId, { key: string; onlyPaid?: true }> = {
  [Chains.ETHEREUM.chainId]: { key: 'eth-mainnet' },
  [Chains.ETHEREUM_SEPOLIA.chainId]: { key: 'eth-sepolia' },
  [Chains.OPTIMISM.chainId]: { key: 'opt-mainnet' },
  // [Chains.OPTIMISM_SEPOLIA.chainId]: { key: 'opt-sepolia' },
  [Chains.ARBITRUM.chainId]: { key: 'arb-mainnet' },
  // [Chains.ARBITRUM_SEPOLIA.chainId]: { key: 'arb-sepolia' },
  [Chains.POLYGON.chainId]: { key: 'polygon-mainnet' },
  [Chains.POLYGON_MUMBAI.chainId]: { key: 'polygon-mumbai' },
  [Chains.ASTAR.chainId]: { key: 'astar-mainnet' },
  [Chains.BLAST.chainId]: { key: 'blast-mainnet' },
  [Chains.BNB_CHAIN.chainId]: { key: 'bnb-mainnet', onlyPaid: true },
  [Chains.AVALANCHE.chainId]: { key: 'avax-mainnet', onlyPaid: true },
  [Chains.FANTOM.chainId]: { key: 'fantom-mainnet' },
  [Chains.METIS_ANDROMEDA.chainId]: { key: 'metis-mainnet', onlyPaid: true },
  [Chains.POLYGON_ZKEVM.chainId]: { key: 'polygonzkevm-mainnet' },
  // [Chains.POLYGON_ZKEVM_TESTNET.chainId]: { key: 'polygonzkevm-testnet' },
  [Chains.BASE.chainId]: { key: 'base-mainnet' },
  [Chains.GNOSIS.chainId]: { key: 'gnosis-mainnet', onlyPaid: true },
  [Chains.SCROLL.chainId]: { key: 'scroll-mainnet' },
  [Chains.opBNB.chainId]: { key: 'opbnb-mainnet', onlyPaid: true },
  // [Chains.BASE_SEPOLIA.chainId]: { key: 'base-sepolia' },
  // [Chains.ZKSYNC.chainId]: { key: 'zksync-mainnet' },
  // [Chains.ZKSYNC_SEPOLIA.chainId]: { key: 'zksync-sepolia' },
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

export function alchemySupportedChains(args?: { onlyFree: true }): ChainId[] {
  return Object.entries(ALCHEMY_NETWORKS)
    .filter(([_, { onlyPaid }]) => !onlyPaid || !args?.onlyFree)
    .map(([chainId]) => Number(chainId));
}

export function buildAlchemyRPCUrl({ chainId, apiKey, protocol }: { chainId: ChainId; apiKey: string; protocol: 'https' | 'wss' }) {
  const { key: alchemyNetwork } = ALCHEMY_NETWORKS[chainId];
  return `${protocol}://${alchemyNetwork}.g.alchemy.com/v2/${apiKey}`;
}
