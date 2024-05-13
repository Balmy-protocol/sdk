import { reduceTimeout, timeoutPromise } from '@shared/timeouts';
import { ChainId, TimeString, Timestamp, TokenAddress } from '@types';
import { PriceResult, IPriceSource, PricesQueriesSupport, PriceInput } from '../types';
import {
  doesResponseFulfillRequest,
  fillResponseWithNewResult,
  filterRequestForSource,
  combineSupport,
  getSourcesThatSupportRequestOrFail,
} from './utils';
import { groupByChain } from '@shared/utils';

// This source will take a list of sources, sorted by priority, and combine the results of each
// one to try to fulfill the request. The response will prioritize the sources results based on the prioritized
export class PrioritizedPriceSource implements IPriceSource {
  constructor(private readonly sources: IPriceSource[]) {
    if (sources.length === 0) throw new Error('No sources were specified');
  }

  supportedQueries() {
    return combineSupport(this.sources);
  }

  async getCurrentPrices({ tokens, config }: { tokens: PriceInput[]; config?: { timeout?: TimeString } }) {
    return executePrioritized({
      allSources: this.sources,
      fullRequest: tokens,
      query: 'getCurrentPrices',
      getResult: (source, filteredRequest, sourceTimeout) =>
        source.getCurrentPrices({
          tokens: filteredRequest,
          config: { timeout: sourceTimeout },
        }),
      timeout: config?.timeout,
    });
  }

  getHistoricalPrices({
    tokens,
    timestamp,
    searchWidth,
    config,
  }: {
    tokens: PriceInput[];
    timestamp: Timestamp;
    searchWidth?: TimeString;
    config?: { timeout?: TimeString };
  }): Promise<Record<ChainId, Record<TokenAddress, PriceResult>>> {
    return executePrioritized({
      allSources: this.sources,
      fullRequest: tokens,
      query: 'getHistoricalPrices',
      getResult: (source, filteredRequest, sourceTimeout) =>
        source.getHistoricalPrices({
          tokens: filteredRequest,
          timestamp,
          searchWidth,
          config: { timeout: sourceTimeout },
        }),
      timeout: config?.timeout,
    });
  }

  getBulkHistoricalPrices({
    tokens,
    searchWidth,
    config,
  }: {
    tokens: { chainId: ChainId; token: TokenAddress; timestamp: Timestamp }[];
    searchWidth: TimeString | undefined;
    config: { timeout?: TimeString } | undefined;
  }): Promise<Record<ChainId, Record<TokenAddress, Record<Timestamp, PriceResult>>>> {
    return executePrioritized({
      allSources: this.sources,
      fullRequest: tokens,
      query: 'getBulkHistoricalPrices',
      getResult: (source, filteredRequest, sourceTimeout) =>
        source.getBulkHistoricalPrices({
          tokens: filteredRequest,
          searchWidth,
          config: { timeout: sourceTimeout },
        }),
      timeout: config?.timeout,
    });
  }

  async getChart({
    tokens,
    span,
    period,
    bound,
    searchWidth,
    config,
  }: {
    tokens: PriceInput[];
    span: number;
    period: TimeString;
    bound: { from: Timestamp } | { upTo: Timestamp | 'now' };
    searchWidth?: TimeString;
    config: { timeout?: TimeString } | undefined;
  }): Promise<Record<ChainId, Record<TokenAddress, PriceResult[]>>> {
    return executePrioritized({
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
  }
}

async function executePrioritized<Request extends PriceInput, Result>({
  allSources,
  fullRequest,
  query,
  getResult,
  timeout,
}: {
  allSources: IPriceSource[];
  fullRequest: Request[];
  query: keyof PricesQueriesSupport;
  getResult: (
    source: IPriceSource,
    filteredRequest: Request[],
    sourceTimeout: TimeString | undefined
  ) => Promise<Record<ChainId, Record<TokenAddress, Result>>>;
  timeout: TimeString | undefined;
}) {
  const sourcesInChains = getSourcesThatSupportRequestOrFail(fullRequest, allSources, query);
  const addressesPerChain: Record<ChainId, TokenAddress[]> = groupByChain(fullRequest, ({ token }) => token);
  const reducedTimeout = reduceTimeout(timeout, '100');
  return new Promise<Record<ChainId, Record<TokenAddress, Result>>>(async (resolve) => {
    const result: Record<ChainId, Record<TokenAddress, Result>> = {};
    const fetchPromises = sourcesInChains.map(
      (source) =>
        timeoutPromise(getResult(source, filterRequestForSource(fullRequest, query, source), reducedTimeout), reducedTimeout, {
          description: 'Timeouted while executing a prioritized price query',
        }).catch(() => ({})) // Handle rejection and return empty result
    );

    let i = 0;
    while (!doesResponseFulfillRequest(result, addressesPerChain) && i < fetchPromises.length) {
      const response = await fetchPromises[i];
      fillResponseWithNewResult(result, response);
      i++;
    }
    // Return whatever we could fetch
    resolve(result);
  });
}
