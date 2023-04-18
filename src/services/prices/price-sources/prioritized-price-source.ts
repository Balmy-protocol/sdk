import { reduceTimeout, timeoutPromise } from '@shared/timeouts';
import { ChainId, TimeString, Timestamp, TokenAddress } from '@types';
import { HistoricalPriceResult, IPriceSource, PricesQueriesSupport } from '../types';
import {
  doesResponseFulfillRequest,
  fillResponseWithNewResult,
  filterRequestForSource,
  combineSupport,
  getSourcesThatSupportRequestOrFail,
} from './utils';

// This source will take a list of sources, sorted by priority, and combine the results of each
// one to try to fulfill the request. The response will prioritize the sources results based on the prioritized
export class PrioritizedPriceSource implements IPriceSource {
  constructor(private readonly sources: IPriceSource[]) {
    if (sources.length === 0) throw new Error('No sources were specified');
  }

  supportedQueries() {
    return combineSupport(this.sources);
  }

  async getCurrentPrices({ addresses, config }: { addresses: Record<ChainId, TokenAddress[]>; config?: { timeout?: TimeString } }) {
    return executePrioritized(
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
  }

  getHistoricalPrices({
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
    return executePrioritized(
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
  }
}

async function executePrioritized<T>(
  allSources: IPriceSource[],
  fullRequest: Record<ChainId, TokenAddress[]>,
  query: keyof PricesQueriesSupport,
  getResult: (
    source: IPriceSource,
    filteredRequest: Record<ChainId, TokenAddress[]>,
    sourceTimeout: TimeString | undefined
  ) => Promise<Record<ChainId, Record<TokenAddress, T>>>,
  timeout: TimeString | undefined
) {
  const sourcesInChains = getSourcesThatSupportRequestOrFail(fullRequest, allSources, query);
  const reducedTimeout = reduceTimeout(timeout, '100');
  return new Promise<Record<ChainId, Record<TokenAddress, T>>>(async (resolve) => {
    const result: Record<ChainId, Record<TokenAddress, T>> = {};
    const fetchPromises = sourcesInChains.map(
      (source) =>
        timeoutPromise(getResult(source, filterRequestForSource(fullRequest, query, source), reducedTimeout), reducedTimeout).catch(() => ({})) // Handle rejection and return empty result
    );

    let i = 0;
    while (!doesResponseFulfillRequest(result, fullRequest) && i < fetchPromises.length) {
      const response = await fetchPromises[i];
      fillResponseWithNewResult(result, response);
      i++;
    }
    // Return whatever we could fetch
    resolve(result);
  });
}
