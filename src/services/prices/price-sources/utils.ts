import { ChainId, TokenAddress } from '@types';
import { IPriceSource, PriceInput, PricesQueriesSupport } from '../types';

export function fillResponseWithNewResult<T>(
  result: Record<ChainId, Record<TokenAddress, T>>,
  newResult: Record<ChainId, Record<TokenAddress, T>>
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

export function doesResponseFulfillRequest<T>(result: Record<ChainId, Record<TokenAddress, T>>, request: Record<ChainId, TokenAddress[]>) {
  for (const chainId in request) {
    for (const address of request[chainId]) {
      if (typeof result[chainId]?.[address] === 'undefined') {
        return false;
      }
    }
  }
  return true;
}

function doesSourceSupportQueryInAnyOfTheChains(source: IPriceSource, query: keyof PricesQueriesSupport, chains: ChainId[]) {
  const support = source.supportedQueries();
  return chains.some((chainId) => support[chainId]?.[query]);
}

export function filterRequestForSource<T extends { chainId: ChainId }>(
  request: T[],
  query: keyof PricesQueriesSupport,
  source: IPriceSource
): T[] {
  const support = source.supportedQueries();
  return request.filter(({ chainId }) => support[chainId]?.[query]);
}

export function combineSupport(sources: IPriceSource[]): Record<ChainId, PricesQueriesSupport> {
  const result: Record<ChainId, PricesQueriesSupport> = {};
  for (const source of sources) {
    for (const [chainIdString, support] of Object.entries(source.supportedQueries())) {
      const chainId = Number(chainIdString);
      const current = result[chainId] ?? {
        getCurrentPrices: false,
        getHistoricalPrices: false,
        getBulkHistoricalPrices: false,
        getChart: false,
      };
      result[chainId] = {
        getCurrentPrices: current.getCurrentPrices || support.getCurrentPrices,
        getHistoricalPrices: current.getHistoricalPrices || support.getHistoricalPrices,
        getBulkHistoricalPrices: current.getBulkHistoricalPrices || support.getBulkHistoricalPrices,
        getChart: current.getChart || support.getChart,
      };
    }
  }
  return result;
}

export function getSourcesThatSupportRequestOrFail<T extends PriceInput>(
  request: T[],
  sources: IPriceSource[],
  query: keyof PricesQueriesSupport
) {
  const chainsInRequest = [...new Set(request.map(({ chainId }) => chainId))];
  const sourcesInChain = sources.filter((source) => doesSourceSupportQueryInAnyOfTheChains(source, query, chainsInRequest));
  if (sourcesInChain.length === 0) throw new Error(`Current price sources can't support all the given chains`);
  return sourcesInChain;
}

export function nowInSeconds() {
  return Math.floor(Date.now() / 1000);
}
