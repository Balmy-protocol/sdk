import { Chains } from '@chains';
import { ChainId } from '@types';
import { ethers } from 'ethers';

const ALCHEMY_URLs: Record<ChainId, string> = {
  [Chains.ETHEREUM.chainId]: 'eth-mainnet.g.alchemy.com/v2',
  [Chains.ETHEREUM_GOERLI.chainId]: 'eth-goerli.g.alchemy.com/v2',
  [Chains.ETHEREUM_SEPOLIA.chainId]: 'eth-sepolia.g.alchemy.com/v2',
  [Chains.POLYGON.chainId]: 'polygon-mainnet.g.alchemy.com/v2',
  [Chains.OPTIMISM.chainId]: 'opt-mainnet.g.alchemy.com/v2',
  [Chains.ARBITRUM.chainId]: 'arb-mainnet.g.alchemy.com/v2',
  [Chains.ASTAR.chainId]: 'astar-mainnet.g.alchemy.com/v2',
  // [Chains.POLYGON_ZKEVM.chainId]: 'polygonzkevm-mainnet.g.alchemy.com/v2', TODO: Add support
};

export function alchemySupportedChains(): ChainId[] {
  return Object.keys(ALCHEMY_URLs).map(Number);
}

export function callAlchemyRPC(alchemyKey: string, protocol: 'https' | 'wss', chainId: ChainId, method: string, params: any) {
  return buildAlchemyProvider(alchemyKey, protocol, chainId).send(method, params);
}

export function buildAlchemyUrl(alchemyKey: string, protocol: 'https' | 'wss', chainId: ChainId) {
  return `${protocol}://${getPath(alchemyKey, chainId)}`;
}

function buildAlchemyProvider(alchemyKey: string, protocol: 'https' | 'wss', chainId: ChainId) {
  const url = buildAlchemyUrl(alchemyKey, protocol, chainId);
  return protocol === 'https' ? new ethers.providers.JsonRpcProvider(url, chainId) : new ethers.providers.WebSocketProvider(url, chainId);
}

function getPath(alchemyKey: string, chainId: ChainId) {
  const url = ALCHEMY_URLs[chainId];
  if (!url) throw new Error(`Unsupported chain with id ${chainId}`);
  return `${url}/${alchemyKey}`;
}
