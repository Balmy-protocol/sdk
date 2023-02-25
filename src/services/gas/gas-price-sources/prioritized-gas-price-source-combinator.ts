import { chainsUnion } from '@chains';
import { ChainId, TimeString } from '@types';
import { IGasPriceSource, MergeGasSpeedsFromSources } from '../types';
import { combineSupportedSpeeds } from './utils';

// This source will take a list of sources, sorted by priority, and use the first one possible
// that supports the given chain
export class PrioritizedGasPriceSourceCombinator<Sources extends IGasPriceSource<any>[] | []>
  implements IGasPriceSource<MergeGasSpeedsFromSources<Sources>>
{
  constructor(private readonly sources: Sources) {}

  supportedSpeeds() {
    return combineSupportedSpeeds(this.sources);
  }

  getGasPrice({ chainId, context }: { chainId: ChainId; context?: { timeout?: TimeString } }) {
    const source = this.sources.find((source) => chainId in source.supportedSpeeds());
    if (!source) throw new Error(`Chain with id ${chainId} not supported`);
    return source.getGasPrice({ chainId, context });
  }
}
