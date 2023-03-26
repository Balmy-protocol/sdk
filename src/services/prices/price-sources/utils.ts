import { ChainId, TokenAddress } from '@types';
import { TokenPrice, IPriceSource } from '../types';

export function fillResponseWithNewResult(
  result: Record<ChainId, Record<TokenAddress, TokenPrice>>,
  newResult: Record<ChainId, Record<TokenAddress, TokenPrice>>
) {
  for (const chainId in newResult) {
    for (const address in newResult[chainId]) {
      if (!result[chainId]?.[address]) {
        if (!(chainId in result)) {
          result[chainId] = {};
        }
        result[chainId][address] = newResult[chainId][address];
      }
    }
  }
}

export function doesResponseFulfillRequest(result: Record<ChainId, Record<TokenAddress, TokenPrice>>, request: Record<ChainId, TokenAddress[]>) {
  for (const chainId in request) {
    for (const address of request[chainId]) {
      if (typeof result[chainId]?.[address] !== 'number') {
        return false;
      }
    }
  }
  return true;
}

export function doesSourceSupportAnyOfTheChains(source: IPriceSource, chains: ChainId[]) {
  const supportedChains = new Set(source.supportedChains());
  return chains.some((chainId) => supportedChains.has(chainId));
}

export function filterRequestForSource(request: Record<ChainId, TokenAddress[]>, source: IPriceSource) {
  const supportedChains = new Set(source.supportedChains());
  const entries = Object.entries(request).filter(([chainId]) => supportedChains.has(Number(chainId)));
  return Object.fromEntries(entries);
}
