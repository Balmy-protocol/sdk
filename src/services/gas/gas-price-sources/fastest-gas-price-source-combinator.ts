import { ChainId, TimeString } from '@types';
import { IGasPriceSource, MergeGasSpeedsFromSources } from '../types';
import { combineSupportedSpeeds, keepSourcesWithMatchingSupportOnChain } from './utils';

// This source will take a list of sources, and try to calculate the gas price on all of them, returning
// the one that resolves first
export class FastestGasPriceSourceCombinator<Sources extends IGasPriceSource<any>[] | []>
  implements IGasPriceSource<MergeGasSpeedsFromSources<Sources>>
{
  constructor(private readonly sources: Sources) {}

  supportedSpeeds() {
    return combineSupportedSpeeds(this.sources);
  }

  getGasPrice({ chainId, context }: { chainId: ChainId; context?: { timeout?: TimeString } }) {
    const sourcesInChain = keepSourcesWithMatchingSupportOnChain(chainId, this.sources);
    if (sourcesInChain.length === 0) throw new Error(`Chain with id ${chainId} not supported`);
    return Promise.any(sourcesInChain.map((source) => source.getGasPrice({ chainId, context })));
  }
}
