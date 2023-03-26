import { chainsUnion } from '@chains';
import { reduceTimeout, timeoutPromise } from '@shared/timeouts';
import { ChainId, TimeString, TokenAddress } from '@types';
import { IPriceSource, TokenPrice } from '../types';

// This source will take a list of sources, sorted by priority, and combine the results of each
// one to try to fulfill the request. The response will prioritize the sources results based on the prioritized
export class PrioritizedPriceSource implements IPriceSource {
  constructor(private readonly sources: IPriceSource[]) {
    if (sources.length === 0) throw new Error('No sources were specified');
  }

  async getCurrentPrices({
    addresses,
    config,
  }: {
    addresses: Record<ChainId, TokenAddress[]>;
    config?: { timeout?: TimeString };
  }): Promise<Record<ChainId, Record<TokenAddress, TokenPrice>>> {
    const chainsInRequest = Object.keys(addresses).map(Number);
    const sourcesInChain = this.sources.filter((source) => doesSourceSupportAnyOfTheChains(source, chainsInRequest));
    if (sourcesInChain.length === 0) throw new Error(`Current price sources can't support all the given chains`);

    const fetchPromises = fetchPrices(sourcesInChain, addresses, reduceTimeout(config?.timeout, '100'));

    return new Promise<Record<ChainId, Record<TokenAddress, TokenPrice>>>(async (resolve) => {
      const result: Record<ChainId, Record<TokenAddress, TokenPrice>> = {};
      let i = 0;
      while (!doesResponseFulfillRequest(result, addresses) && i < fetchPromises.length) {
        const response = await fetchPromises[i];
        fillResponseWithNewResult(result, response);
        i++;
      }
      // Return whatever we could fetch
      resolve(result);
    });
  }

  supportedChains() {
    return chainsUnion(this.sources.map((source) => source.supportedChains()));
  }
}

function fetchPrices(sources: IPriceSource[], request: Record<ChainId, TokenAddress[]>, timeout?: TimeString) {
  return sources.map(
    (source) =>
      timeoutPromise(
        source.getCurrentPrices({
          addresses: filterRequestForSource(request, source),
          config: { timeout },
        }),
        timeout
      ).catch(() => ({})) // Handle rejection and return empty result
  );
}

function fillResponseWithNewResult(
  result: Record<ChainId, Record<TokenAddress, TokenPrice>>,
  newResult: Record<ChainId, Record<TokenAddress, TokenPrice>>
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

function doesResponseFulfillRequest(result: Record<ChainId, Record<TokenAddress, TokenPrice>>, request: Record<ChainId, TokenAddress[]>) {
  for (const chainId in request) {
    for (const address of request[chainId]) {
      if (typeof result[chainId]?.[address] !== 'number') {
        return false;
      }
    }
  }
  return true;
}

function doesSourceSupportAnyOfTheChains(source: IPriceSource, chains: ChainId[]) {
  const supportedChains = new Set(source.supportedChains());
  return chains.some((chainId) => supportedChains.has(chainId));
}

function filterRequestForSource(request: Record<ChainId, TokenAddress[]>, source: IPriceSource) {
  const supportedChains = new Set(source.supportedChains());
  const entries = Object.entries(request).filter(([chainId]) => supportedChains.has(Number(chainId)));
  return Object.fromEntries(entries);
}
