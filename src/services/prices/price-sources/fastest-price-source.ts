import { reduceTimeout, timeoutPromise } from '@shared/timeouts';
import { ChainId, TimeString, Timestamp, TokenAddress } from '@types';
import { HistoricalPriceResult, IPriceSource, PricesQueriesSupport } from '../types';
import {
  filterRequestForSource,
  fillResponseWithNewResult,
  doesResponseFulfillRequest,
  combineSupport,
  getSourcesThatSupportRequestOrFail,
} from './utils';

// This source will take a list of sources and combine the results of each one to try to fulfill
// the request. As soon as there there is a response that is valid for the request, it will be returned
export class FastestPriceSource implements IPriceSource {
  constructor(private readonly sources: IPriceSource[]) {
    if (sources.length === 0) throw new Error('No sources were specified');
  }

  supportedQueries() {
    return combineSupport(this.sources);
  }

  getCurrentPrices({ addresses, config }: { addresses: Record<ChainId, TokenAddress[]>; config?: { timeout?: TimeString } }) {
    return executeFastest(
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
    return executeFastest(
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

async function executeFastest<T>(
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
    const allPromises = sourcesInChains.map((source) =>
      timeoutPromise(getResult(source, filterRequestForSource(fullRequest, query, source), reducedTimeout), reducedTimeout).then((response) => {
        fillResponseWithNewResult(result, response);
        if (doesResponseFulfillRequest(result, fullRequest)) {
          resolve(result);
        }
      })
    );

    Promise.allSettled(allPromises).then(() => {
      if (!doesResponseFulfillRequest(result, fullRequest)) {
        // We couldn't fulfil the request, so we know we didn't resolve.
        // We will return whatever we could fetch
        resolve(result);
      }
    });
  });
}
