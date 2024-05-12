import { reduceTimeout, timeoutPromise } from '@shared/timeouts';
import { ChainId, TimeString, Timestamp, TokenAddress } from '@types';
import { PriceResult, IPriceSource, PricesQueriesSupport, PriceInput } from '../types';
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

  getCurrentPrices({ tokens, config }: { tokens: PriceInput[]; config?: { timeout?: TimeString } }) {
    return executeFastest({
      allSources: this.sources,
      fullRequest: tokens,
      query: 'getCurrentPrices',
      addressesFromRequest: (tokens) => tokens.map(({ token }) => token),
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
    return executeFastest({
      allSources: this.sources,
      fullRequest: tokens,
      query: 'getHistoricalPrices',
      addressesFromRequest: (tokens) => tokens.map(({ token }) => token),
      getResult: (source, filteredRequest, sourceTimeout) =>
        source.getHistoricalPrices({
          token: filteredRequest,
          timestamp,
          searchWidth,
          config: { timeout: sourceTimeout },
        }),
      timeout: config?.timeout,
    });
  }

  getBulkHistoricalPrices({
    addresses,
    searchWidth,
    config,
  }: {
    addresses: Record<ChainId, { token: TokenAddress; timestamp: Timestamp }[]>;
    searchWidth: TimeString | undefined;
    config: { timeout?: TimeString } | undefined;
  }): Promise<Record<ChainId, Record<TokenAddress, Record<Timestamp, PriceResult>>>> {
    return executeFastest({
      allSources: this.sources,
      fullRequest: addresses,
      query: 'getBulkHistoricalPrices',
      addressesFromRequest: (request) => request.map(({ token }) => token),
      getResult: (source, filteredRequest, sourceTimeout) =>
        source.getBulkHistoricalPrices({
          addresses: filteredRequest,
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
    return executeFastest({
      allSources: this.sources,
      fullRequest: tokens,
      query: 'getChart',
      addressesFromRequest: (tokens) => tokens,
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

async function executeFastest<Request extends PriceInput, Result>({
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
  const reducedTimeout = reduceTimeout(timeout, '100');
  const addressesPerChain: Record<ChainId, TokenAddress[]> = Object.fromEntries(
    Object.entries(fullRequest).map(([chainId, request]) => [chainId, addressesFromRequest(request)])
  );
  return new Promise<Record<ChainId, Record<TokenAddress, Result>>>(async (resolve) => {
    const result: Record<ChainId, Record<TokenAddress, Result>> = {};
    const allPromises = sourcesInChains.map((source) =>
      timeoutPromise(getResult(source, filterRequestForSource(fullRequest, query, source), reducedTimeout), reducedTimeout).then((response) => {
        fillResponseWithNewResult(result, response);
        if (doesResponseFulfillRequest(result, addressesPerChain)) {
          resolve(result);
        }
      })
    );

    Promise.allSettled(allPromises).then(() => {
      if (!doesResponseFulfillRequest(result, addressesPerChain)) {
        // We couldn't fulfil the request, so we know we didn't resolve.
        // We will return whatever we could fetch
        resolve(result);
      }
    });
  });
}
