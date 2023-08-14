import { Chains } from '@chains';
import { ChainId } from '@types';

const MAGPIE_NETWORKS: Record<ChainId, string> = {
  [Chains.ETHEREUM.chainId]: 'ethereum',
  [Chains.POLYGON.chainId]: 'polygon',
  [Chains.BNB_CHAIN.chainId]: 'bsc',
  [Chains.ARBITRUM.chainId]: 'arbitrum',
  [Chains.AVALANCHE.chainId]: 'avalanche',
  [Chains.OPTIMISM.chainId]: 'optimism',
  [Chains.POLYGON_ZKEVM.chainId]: 'polygonzk',
};

export function magpieSupportedChains(): ChainId[] {
  return Object.keys(MAGPIE_NETWORKS).map(Number);
}

export function buildMagpieBalanceManagerUrl(chainId: ChainId) {
  const magpieNetwork = MAGPIE_NETWORKS[chainId];
  return `https://api.magpiefi.xyz/balance-manager/${magpieNetwork}`;
}
