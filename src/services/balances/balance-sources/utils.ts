import { Address, ChainId, TokenAddress } from '@types';
import { IBalanceSource, BalanceInput } from '../types';

export function fillResponseWithNewResult(
  result: Record<ChainId, Record<Address, Record<TokenAddress, bigint>>>,
  newResult: Record<ChainId, Record<Address, Record<TokenAddress, bigint>>>
) {
  for (const chainId in newResult) {
    if (!(chainId in result)) result[chainId] = {};
    for (const address in newResult[chainId]) {
      if (!(address in result[chainId])) result[chainId][address] = {};
      for (const token in newResult[chainId][address]) {
        if (!result[chainId]?.[address]?.[token]) {
          result[chainId][address][token] = newResult[chainId][address][token];
        }
      }
    }
  }
}

export function doesResponseFulfilRequest(result: Record<ChainId, Record<Address, Record<TokenAddress, bigint>>>, request: BalanceInput[]) {
  for (const { chainId, token, account } of request) {
    if (typeof result[chainId]?.[account]?.[token] === 'undefined') {
      return false;
    }
  }
  return true;
}

export function filterRequestForSource(request: BalanceInput[], source: IBalanceSource) {
  const support = source.supportedChains();
  return request.filter(({ chainId }) => support.includes(chainId));
}

export function getSourcesThatSupportRequestOrFail(request: BalanceInput[], sources: IBalanceSource[]) {
  const chainsInRequest = new Set(request.map(({ chainId }) => chainId));
  const sourcesInChain = sources.filter((source) => source.supportedChains().some((chainId) => chainsInRequest.has(chainId)));
  if (sourcesInChain.length === 0) throw new Error('Operation not supported');
  return sourcesInChain;
}
