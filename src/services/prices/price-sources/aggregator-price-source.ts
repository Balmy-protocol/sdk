import { reduceTimeout, timeoutPromise } from '@shared/timeouts';
import { filterRejectedResults } from '@shared/utils';
import { ChainId, TimeString, Timestamp, TokenAddress } from '@types';
import { PriceResult, IPriceSource, PricesQueriesSupport } from '../types';
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
    const collected = await collectAllResults({
      allSources: this.sources,
      fullRequest: addresses,
      query: 'getCurrentPrices',
      getResult: (source, filteredRequest, sourceTimeout) =>
        source.getCurrentPrices({
          addresses: filteredRequest,
          config: { timeout: sourceTimeout },
        }),
      timeout: config?.timeout,
    });
    return this.aggregate(collected, aggregatePrices);
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
  }): Promise<Record<ChainId, Record<TokenAddress, PriceResult>>> {
    const collected = await collectAllResults({
      allSources: this.sources,
      fullRequest: addresses,
      query: 'getHistoricalPrices',
      getResult: (source, filteredRequest, sourceTimeout) =>
        source.getHistoricalPrices({
          addresses: filteredRequest,
          timestamp,
          searchWidth,
          config: { timeout: sourceTimeout },
        }),
      timeout: config?.timeout,
    });
    return this.aggregate(collected, aggregatePrices);
  }

  async getBulkHistoricalPrices({
    addresses,
    searchWidth,
    config,
  }: {
    addresses: Record<ChainId, { token: TokenAddress; timestamp: Timestamp }[]>;
    searchWidth: TimeString | undefined;
    config: { timeout?: TimeString } | undefined;
  }): Promise<Record<ChainId, Record<TokenAddress, Record<Timestamp, PriceResult>>>> {
    const collected = await collectAllResults({
      allSources: this.sources,
      fullRequest: addresses,
      query: 'getBulkHistoricalPrices',
      getResult: (source, filteredRequest, sourceTimeout) =>
        source.getBulkHistoricalPrices({
          addresses: filteredRequest,
          searchWidth,
          config: { timeout: sourceTimeout },
        }),
      timeout: config?.timeout,
    });
    return this.aggregate(collected, aggregateBulkHistoricalPrices);
  }

  async getChart({
    tokens,
    span,
    period,
    bound,
    searchWidth,
    config,
  }: {
    tokens: Record<ChainId, TokenAddress[]>;
    span: number;
    period: TimeString;
    bound: { from: Timestamp } | { upTo: Timestamp | 'now' };
    searchWidth?: TimeString;
    config: { timeout?: TimeString } | undefined;
  }): Promise<Record<ChainId, Record<TokenAddress, PriceResult[]>>> {
    const collected = await collectAllResults({
      allSources: this.sources,
      fullRequest: tokens,
      query: 'getChart',
      getResult: (source, filteredRequest, sourceTimeout) =>
        source.getChart({
          tokens: filteredRequest,
          span,
          period,
          bound,
          searchWidth,
          config: { timeout: sourceTimeout },
        }),
      timeout: config?.timeout,
    });
    // TODO: Support more than one source
    return Object.fromEntries(
      Object.entries(collected).map(([chain, tokens]) => [
        parseInt(chain),
        Object.fromEntries(Object.entries(tokens).map(([token, prices]) => [token, prices[0]])),
      ])
    );
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

async function collectAllResults<Request, Result>({
  allSources,
  fullRequest,
  query,
  getResult,
  timeout,
}: {
  allSources: IPriceSource[];
  fullRequest: Record<ChainId, Request>;
  query: keyof PricesQueriesSupport;
  getResult: (
    source: IPriceSource,
    filteredRequest: Record<ChainId, Request>,
    sourceTimeout: TimeString | undefined
  ) => Promise<Record<ChainId, Record<TokenAddress, Result>>>;
  timeout: TimeString | undefined;
}): Promise<Record<ChainId, Record<TokenAddress, Result[]>>> {
  const sourcesInChains = getSourcesThatSupportRequestOrFail(fullRequest, allSources, query);
  const reducedTimeout = reduceTimeout(timeout, '100');
  const promises = sourcesInChains.map((source) =>
    timeoutPromise(getResult(source, filterRequestForSource(fullRequest, query, source), reducedTimeout), reducedTimeout, {
      description: 'Timeouted while executing an aggregated price query',
    })
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
        if (typeof result?.[chainId]?.[address] !== 'undefined') {
          collected[chainId][address].push(result[chainId][address]);
        }
      }
    }
  }
  return collected;
}

function aggregatePrices(results: PriceResult[], method: PriceAggregationMethod): PriceResult {
  const sorted = results.sort((a, b) => a.price - b.price);
  switch (method) {
    case 'median':
      if (sorted.length > 0 && sorted.length % 2 === 0) {
        const middleLow = sorted[sorted.length / 2 - 1];
        const middleHigh = sorted[sorted.length / 2];
        return {
          price: (middleLow.price + middleHigh.price) / 2,
          closestTimestamp: (middleLow.closestTimestamp + middleHigh.closestTimestamp) / 2,
        };
      } else {
        return sorted[Math.floor(sorted.length / 2)];
      }
    case 'avg':
      const sumPrice = sumAll(results.map(({ price }) => price));
      const sumTimestamp = sumAll(results.map(({ closestTimestamp: timestamp }) => timestamp));
      return {
        price: sumPrice / results.length,
        closestTimestamp: sumTimestamp / results.length,
      };
    case 'max':
      return sorted[sorted.length - 1];
    case 'min':
      return sorted[0];
  }
}

function aggregateBulkHistoricalPrices(
  results: Record<Timestamp, PriceResult>[],
  method: PriceAggregationMethod
): Record<Timestamp, PriceResult> {
  const allTimestamps: Timestamp[] = [...new Set(results.flatMap((result) => Object.keys(result)))].map(Number);
  const collectedByTimestamp = allTimestamps.map((timestamp) => ({ timestamp, results: extractResultInTimestamp(timestamp, results) }));
  return Object.fromEntries(collectedByTimestamp.map(({ timestamp, results }) => [timestamp, aggregatePrices(results, method)]));
}

function extractResultInTimestamp(timestamp: Timestamp, results: Record<Timestamp, PriceResult>[]): PriceResult[] {
  return results.filter((result) => timestamp in result).map((result) => result[timestamp]);
}

function sumAll(array: number[]): number {
  return array.reduce((accum, curr) => accum + curr, 0);
}
