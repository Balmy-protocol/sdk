import { reduceTimeout, timeoutPromise } from '@shared/timeouts';
import { Address, AmountOfToken, ChainId, TimeString, TokenAddress } from '@types';
import {
  filterRequestForSource,
  fillResponseWithNewResult,
  doesResponseFulfilRequest,
  combineSupport,
  getSourcesThatSupportRequestOrFail,
} from './utils';
import { IBalanceSource, BalanceQueriesSupport } from '../types';

// This source will take a list of sources and combine the results of each one to try to fulfil
// the request. As soon as there there is a response that is valid for the request, it will be returned
export class FastestBalanceSource implements IBalanceSource {
  constructor(private readonly sources: IBalanceSource[]) {
    if (sources.length === 0) throw new Error('No sources were specified');
  }

  supportedQueries() {
    return combineSupport(this.sources);
  }

  getTokensHeldByAccounts({
    accounts,
    config,
  }: {
    accounts: Record<ChainId, Address[]>;
    config?: { timeout?: TimeString };
  }): Promise<Record<ChainId, Record<Address, Record<TokenAddress, AmountOfToken>>>> {
    return executeFastest({
      allSources: this.sources,
      fullRequest: accounts,
      expected: Object.fromEntries(
        Object.entries(accounts).map(([chainId, accounts]) => [chainId, Object.fromEntries(accounts.map((account) => [account, []]))])
      ),
      query: 'getTokensHeldByAccount',
      getResult: (source, filteredRequest, sourceTimeout) =>
        source.getTokensHeldByAccounts({
          accounts: filteredRequest,
          config: { timeout: sourceTimeout },
        }),
      timeout: config?.timeout,
    });
  }

  getBalancesForTokens({
    tokens,
    config,
  }: {
    tokens: Record<ChainId, Record<Address, TokenAddress[]>>;
    config?: { timeout?: TimeString };
  }): Promise<Record<ChainId, Record<Address, Record<TokenAddress, AmountOfToken>>>> {
    return executeFastest({
      allSources: this.sources,
      fullRequest: tokens,
      expected: tokens,
      query: 'getBalancesForTokens',
      getResult: (source, filteredRequest, sourceTimeout) =>
        source.getBalancesForTokens({
          tokens: filteredRequest,
          config: { timeout: sourceTimeout },
        }),
      timeout: config?.timeout,
    });
  }
}

async function executeFastest<Request>({
  allSources,
  fullRequest,
  query,
  getResult,
  expected,
  timeout,
}: {
  allSources: IBalanceSource[];
  fullRequest: Record<ChainId, Request>;
  query: keyof BalanceQueriesSupport;
  getResult: (
    source: IBalanceSource,
    filteredRequest: Record<ChainId, Request>,
    sourceTimeout: TimeString | undefined
  ) => Promise<Record<ChainId, Record<Address, Record<TokenAddress, AmountOfToken>>>>;
  expected: Record<ChainId, Record<Address, TokenAddress[]>>;
  timeout: TimeString | undefined;
}) {
  const sourcesInChains = getSourcesThatSupportRequestOrFail(fullRequest, allSources, query);
  const reducedTimeout = reduceTimeout(timeout, '100');
  return new Promise<Record<ChainId, Record<Address, Record<TokenAddress, AmountOfToken>>>>(async (resolve, reject) => {
    const result: Record<ChainId, Record<Address, Record<TokenAddress, AmountOfToken>>> = {};
    const allPromises = sourcesInChains.map((source) =>
      timeoutPromise(getResult(source, filterRequestForSource(fullRequest, query, source), reducedTimeout), reducedTimeout).then((response) => {
        fillResponseWithNewResult(result, response);
        if (doesResponseFulfilRequest(result, expected)) {
          resolve(result);
        }
      })
    );

    Promise.allSettled(allPromises).then(() => {
      if (!doesResponseFulfilRequest(result, expected)) {
        // We couldn't fulfil the request, so we know we didn't resolve. We will revert then
        reject(new Error('Failed to fulfil request'));
      }
    });
  });
}
