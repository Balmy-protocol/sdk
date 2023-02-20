import { Chains } from '@chains';
import { ChainId } from '@types';
import { ethers } from 'ethers';

const URLs: Record<ChainId, string> = {
  [Chains.ETHEREUM.chainId]: 'eth-mainnet.g.alchemy.com/v2',
  [Chains.POLYGON.chainId]: 'polygon-mainnet.g.alchemy.com/v2',
  [Chains.OPTIMISM.chainId]: 'opt-mainnet.g.alchemy.com/v2',
  [Chains.ARBITRUM.chainId]: 'arb-mainnet.g.alchemy.com/v2',
};

export function alchemySupportedChains(): ChainId[] {
  return Object.keys(URLs).map(Number);
}

export function buildAlchemyProvider(alchemyKey: string, protocol: 'https' | 'wss', chainId: ChainId) {
  const url = `${protocol}://${getPath(alchemyKey, chainId)}`;
  return protocol === 'https' ? new ethers.providers.JsonRpcProvider(url, chainId) : new ethers.providers.WebSocketProvider(url, chainId);
}

export function callAlchemyRPC(alchemyKey: string, protocol: 'https' | 'wss', chainId: ChainId, method: string, params: any) {
  return buildAlchemyProvider(alchemyKey, protocol, chainId).send(method, params);
}

function getPath(alchemyKey: string, chainId: ChainId) {
  const url = URLs[chainId];
  if (!url) throw new Error(`Unsupported chain with id ${chainId}`);
  return `${url}/${alchemyKey}`;
}
