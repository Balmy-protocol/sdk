import { chainsUnion } from '@chains';
import { reduceTimeout, timeoutPromise } from '@shared/timeouts';
import { filterRejectedResults } from '@shared/utils';
import { ChainId, TimeString, TokenAddress } from '@types';
import { IPriceSource, TokenPrice } from '../types';
import { doesSourceSupportAnyOfTheChains, filterRequestForSource } from './utils';

export type PriceAggregationMethod = 'median' | 'min' | 'max' | 'avg';
export class AggregatorPriceSource implements IPriceSource {
  constructor(private readonly sources: IPriceSource[], private readonly method: PriceAggregationMethod) {
    if (sources.length === 0) throw new Error('No sources were specified');
  }

  async getCurrentPrices({ addresses, config }: { addresses: Record<ChainId, TokenAddress[]>; config?: { timeout?: TimeString } }) {
    const chainsInRequest = Object.keys(addresses).map(Number);
    const sourcesInChain = this.sources.filter((source) => doesSourceSupportAnyOfTheChains(source, chainsInRequest));
    if (sourcesInChain.length === 0) throw new Error(`Current price sources can't support all the given chains`);

    const reducedTimeout = reduceTimeout(config?.timeout, '100');
    const promises = sourcesInChain.map((source) =>
      timeoutPromise(
        source.getCurrentPrices({
          addresses: filterRequestForSource(addresses, source),
          config: { timeout: reducedTimeout },
        }),
        reducedTimeout
      )
    );
    const results = await filterRejectedResults(promises);
    if (results.length === 0) return {};
    return this.aggregate(results);
  }

  supportedChains() {
    return chainsUnion(this.sources.map((source) => source.supportedChains()));
  }

  private aggregate(results: Record<ChainId, Record<TokenAddress, TokenPrice>>[]) {
    const collected = collect(results);
    const result: Record<ChainId, Record<TokenAddress, TokenPrice>> = {};
    for (const chainId in collected) {
      result[chainId] = {};
      for (const address in collected[chainId]) {
        result[chainId][address] = aggregate(collected[chainId][address], this.method);
      }
    }
    return result;
  }
}

function collect(results: Record<ChainId, Record<TokenAddress, TokenPrice>>[]) {
  const collected: Record<ChainId, Record<TokenAddress, TokenPrice[]>> = {};
  for (const result of results) {
    for (const chainId in result) {
      if (!(chainId in collected)) {
        collected[chainId] = {};
      }
      for (const address in result[chainId]) {
        if (!(address in collected[chainId])) {
          collected[chainId][address] = [];
        }
        if (typeof result?.[chainId]?.[address] === 'number') {
          collected[chainId][address].push(result[chainId][address]);
        }
      }
    }
  }
  return collected;
}

function aggregate(results: TokenPrice[], method: PriceAggregationMethod): TokenPrice {
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
      const sum = results.reduce((accum, curr) => accum + curr);
      return sum / results.length;
    case 'max':
      return Math.max(...results);
    case 'min':
      return Math.min(...results);
  }
}
