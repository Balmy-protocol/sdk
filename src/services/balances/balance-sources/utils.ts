import { Address, AmountOfToken, ChainId, TokenAddress } from '@types';
import { IBalanceSource, BalanceQueriesSupport } from '../types';

export function fillResponseWithNewResult(
  result: Record<ChainId, Record<Address, Record<TokenAddress, AmountOfToken>>>,
  newResult: Record<ChainId, Record<Address, Record<TokenAddress, AmountOfToken>>>
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

export function doesResponseFulfilRequest(
  result: Record<ChainId, Record<Address, Record<TokenAddress, AmountOfToken>>>,
  request: Record<ChainId, Record<Address, TokenAddress[]>>
) {
  for (const chainId in request) {
    for (const address in request[chainId]) {
      const tokens = request[chainId][address];
      if (tokens.length === 0) {
        if (typeof result[chainId]?.[address] === 'undefined') {
          return false;
        }
      } else {
        for (const token of tokens) {
          if (typeof result[chainId]?.[address]?.[token] === 'undefined') {
            return false;
          }
        }
      }
    }
  }
  return true;
}

function doesSourceSupportQueryInAnyOfTheChains(source: IBalanceSource, query: keyof BalanceQueriesSupport, chains: ChainId[]) {
  const support = source.supportedQueries();
  return chains.some((chainId) => support[chainId]?.[query]);
}

export function filterRequestForSource<T>(
  request: Record<ChainId, T>,
  query: keyof BalanceQueriesSupport,
  source: IBalanceSource
): Record<ChainId, T> {
  const support = source.supportedQueries();
  const entries = Object.entries(request).filter(([chainId]) => support[Number(chainId)]?.[query]);
  return Object.fromEntries(entries);
}

export function combineSupport(sources: IBalanceSource[]): Record<ChainId, BalanceQueriesSupport> {
  const result: Record<ChainId, BalanceQueriesSupport> = {};
  for (const source of sources) {
    for (const [chainIdString, support] of Object.entries(source.supportedQueries())) {
      const chainId = Number(chainIdString);
      const current = result[chainId] ?? { getBalancesForTokens: false, getTokensHeldByAccount: false };
      result[chainId] = {
        getBalancesForTokens: current.getBalancesForTokens || support.getBalancesForTokens,
        getTokensHeldByAccount: current.getTokensHeldByAccount || support.getTokensHeldByAccount,
      };
    }
  }
  return result;
}

export function getSourcesThatSupportRequestOrFail<T>(
  request: Record<ChainId, T>,
  sources: IBalanceSource[],
  query: keyof BalanceQueriesSupport
) {
  const chainsInRequest = Object.keys(request).map(Number);
  const sourcesInChain = sources.filter((source) => doesSourceSupportQueryInAnyOfTheChains(source, query, chainsInRequest));
  if (sourcesInChain.length === 0) throw new Error('Operation not supported');
  return sourcesInChain;
}
