import { reduceTimeout, timeoutPromise } from '@shared/timeouts';
import { filterRejectedResults } from '@shared/utils';
import { ChainId, TimeString, TokenAddress } from '@types';
import { HistoricalPriceResult, IPriceSource, PricesQueriesSupport, Timestamp, TokenPrice } from '../types';
import { combineSupport, filterRequestForSource, getSourcesThatSupportRequestOrFail } from './utils';

export type PriceAggregationMethod = 'median' | 'min' | 'max' | 'avg';
export class AggregatorPriceSource implements IPriceSource {
  constructor(private readonly sources: IPriceSource[], private readonly method: PriceAggregationMethod) {
    if (sources.length === 0) throw new Error('No sources were specified');
  }

  supportedQueries() {
    return combineSupport(this.sources);
  }

  async getCurrentPrices({ addresses, config }: { addresses: Record<ChainId, TokenAddress[]>; config?: { timeout?: TimeString } }) {
    const collected = await collectAllResults(
      this.sources,
      addresses,
      'getCurrentPrices',
      (source, filteredRequest, sourceTimeout) =>
        source.getCurrentPrices({
          addresses: filteredRequest,
          config: { timeout: sourceTimeout },
        }),
      config?.timeout
    );
    return this.aggregate(collected, aggregateCurrentPrices);
  }

  async getHistoricalPrices({
    addresses,
    timestamp,
    searchWidth,
    config,
  }: {
    addresses: Record<ChainId, TokenAddress[]>;
    timestamp: Timestamp;
    searchWidth?: TimeString;
    config?: { timeout?: TimeString };
  }): Promise<Record<ChainId, Record<TokenAddress, HistoricalPriceResult>>> {
    const collected = await collectAllResults(
      this.sources,
      addresses,
      'getHistoricalPrices',
      (source, filteredRequest, sourceTimeout) =>
        source.getHistoricalPrices({
          addresses: filteredRequest,
          timestamp,
          searchWidth,
          config: { timeout: sourceTimeout },
        }),
      config?.timeout
    );
    return this.aggregate(collected, aggregateHistoricalPrices);
  }

  private aggregate<T>(collected: Record<ChainId, Record<TokenAddress, T[]>>, aggregate: (results: T[], method: PriceAggregationMethod) => T) {
    const result: Record<ChainId, Record<TokenAddress, T>> = {};
    for (const chainId in collected) {
      result[chainId] = {};
      for (const address in collected[chainId]) {
        result[chainId][address] = aggregate(collected[chainId][address], this.method);
      }
    }
    return result;
  }
}

async function collectAllResults<T>(
  allSources: IPriceSource[],
  fullRequest: Record<ChainId, TokenAddress[]>,
  query: keyof PricesQueriesSupport,
  getResult: (
    source: IPriceSource,
    filteredRequest: Record<ChainId, TokenAddress[]>,
    sourceTimeout: TimeString | undefined
  ) => Promise<Record<ChainId, Record<TokenAddress, T>>>,
  timeout: TimeString | undefined
): Promise<Record<ChainId, Record<TokenAddress, T[]>>> {
  const sourcesInChains = getSourcesThatSupportRequestOrFail(fullRequest, allSources, query);
  const reducedTimeout = reduceTimeout(timeout, '100');
  const promises = sourcesInChains.map((source) =>
    timeoutPromise(getResult(source, filterRequestForSource(fullRequest, query, source), reducedTimeout), reducedTimeout)
  );
  const results = await filterRejectedResults(promises);
  return collect(results);
}

function collect<T>(results: Record<ChainId, Record<TokenAddress, T>>[]) {
  const collected: Record<ChainId, Record<TokenAddress, T[]>> = {};
  for (const result of results) {
    for (const chainId in result) {
      if (!(chainId in collected)) {
        collected[chainId] = {};
      }
      for (const address in result[chainId]) {
        if (!(address in collected[chainId])) {
          collected[chainId][address] = [];
        }
        if (typeof result?.[chainId]?.[address] !== undefined) {
          collected[chainId][address].push(result[chainId][address]);
        }
      }
    }
  }
  return collected;
}

function aggregateCurrentPrices(results: TokenPrice[], method: PriceAggregationMethod): TokenPrice {
  switch (method) {
    case 'median':
      const sorted = results.sort();
      if (sorted.length > 0 && sorted.length % 2 === 0) {
        const middleLow = sorted[sorted.length / 2 - 1];
        const middleHigh = sorted[sorted.length / 2];
        return (middleLow + middleHigh) / 2;
      } else {
        return sorted[Math.floor(sorted.length / 2)];
      }
    case 'avg':
      const sum = sumAll(results);
      return sum / results.length;
    case 'max':
      return Math.max(...results);
    case 'min':
      return Math.min(...results);
  }
}

function aggregateHistoricalPrices(results: HistoricalPriceResult[], method: PriceAggregationMethod): HistoricalPriceResult {
  const sorted = results.sort((a, b) => a.price - b.price);
  switch (method) {
    case 'median':
      if (sorted.length > 0 && sorted.length % 2 === 0) {
        const middleLow = sorted[sorted.length / 2 - 1];
        const middleHigh = sorted[sorted.length / 2];
        return {
          price: (middleLow.price + middleHigh.price) / 2,
          timestamp: (middleLow.timestamp + middleHigh.timestamp) / 2,
        };
      } else {
        return sorted[Math.floor(sorted.length / 2)];
      }
    case 'avg':
      const sumPrice = sumAll(results.map(({ price }) => price));
      const sumTimestamp = sumAll(results.map(({ timestamp }) => timestamp));
      return {
        price: sumPrice / results.length,
        timestamp: sumTimestamp / results.length,
      };
    case 'max':
      return sorted[sorted.length - 1];
    case 'min':
      return sorted[0];
  }
}

function sumAll(array: number[]): number {
  return array.reduce((accum, curr) => accum + curr, 0);
}
