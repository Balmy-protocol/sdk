import { chainsUnion } from '@chains';
import { reduceTimeout, timeoutPromise } from '@shared/timeouts';
import { ChainId, TimeString, TokenAddress } from '@types';
import { IPriceSource, TokenPrice } from '../types';
import { doesSourceSupportAnyOfTheChains, filterRequestForSource, fillResponseWithNewResult, doesResponseFulfillRequest } from './utils';

// This source will take a list of sources and combine the results of each one to try to fulfill
// the request. As soon as there there is a response that is valid for the request, it will be returned
export class FastestPriceSource implements IPriceSource {
  constructor(private readonly sources: IPriceSource[]) {
    if (sources.length === 0) throw new Error('No sources were specified');
  }

  async getCurrentPrices({ addresses, config }: { addresses: Record<ChainId, TokenAddress[]>; config?: { timeout?: TimeString } }) {
    const chainsInRequest = Object.keys(addresses).map(Number);
    const sourcesInChain = this.sources.filter((source) => doesSourceSupportAnyOfTheChains(source, chainsInRequest));
    if (sourcesInChain.length === 0) throw new Error(`Current price sources can't support all the given chains`);

    const reducedTimeout = reduceTimeout(config?.timeout, '100');
    return new Promise<Record<ChainId, Record<TokenAddress, TokenPrice>>>(async (resolve) => {
      const result: Record<ChainId, Record<TokenAddress, TokenPrice>> = {};
      const allPromises = sourcesInChain.map((source) =>
        timeoutPromise(
          source.getCurrentPrices({
            addresses: filterRequestForSource(addresses, source),
            config: { timeout: reducedTimeout },
          }),
          reducedTimeout
        ).then((response) => {
          fillResponseWithNewResult(result, response);
          if (doesResponseFulfillRequest(result, addresses)) {
            resolve(result);
          }
        })
      );

      Promise.allSettled(allPromises).then(() => {
        if (!doesResponseFulfillRequest(result, addresses)) {
          // We couldn't fulfil the request, so we know we didn't resolve.
          // We will return whatever we could fetch
          resolve(result);
        }
      });
    });
  }

  supportedChains() {
    return chainsUnion(this.sources.map((source) => source.supportedChains()));
  }
}
