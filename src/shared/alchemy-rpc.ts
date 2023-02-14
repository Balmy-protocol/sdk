import { Chains } from '@chains';
import { IFetchService } from '@services/fetch';
import { ChainId, TimeString } from '@types';

const URLs: Record<ChainId, string> = {
  [Chains.ETHEREUM.chainId]: 'eth-mainnet.g.alchemy.com/v2',
  [Chains.POLYGON.chainId]: 'polygon-mainnet.g.alchemy.com/v2',
  [Chains.OPTIMISM.chainId]: 'opt-mainnet.g.alchemy.com/v2',
  [Chains.ARBITRUM.chainId]: 'arb-mainnet.g.alchemy.com/v2',
};

export function alchemySupportedChains(): ChainId[] {
  return Object.keys(URLs).map(Number);
}

export function callAlchemyRPC(
  fetchService: IFetchService,
  alchemyKey: string,
  chainId: ChainId,
  method: string,
  params: any,
  timeout?: TimeString
) {
  const url = getUrl(alchemyKey, chainId);
  return fetchService.fetch(url, {
    method: 'POST',
    headers: { accept: 'application/json', 'content-type': 'application/json' },
    body: JSON.stringify({
      id: 1,
      jsonrpc: '2.0',
      method,
      params: params,
    }),
    timeout,
  });
}

function getUrl(alchemyKey: string, chainId: ChainId) {
  const url = URLs[chainId];
  if (!url) throw new Error(`Unsupported chain with id ${chainId}`);
  return `https://${url}/${alchemyKey}`;
}
