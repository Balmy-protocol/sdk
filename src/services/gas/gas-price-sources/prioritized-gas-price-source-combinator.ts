import { chainsUnion } from '@chains';
import { ChainId } from '@types';
import { IGasPriceSource, MergeGasSpeedsFromSources } from '../types';

// This source will take a list of sources, sorted by priority, and use the first one possible
// that supports the given chain
export class PrioritizedGasPriceSourceCombinator<Sources extends IGasPriceSource<any>[] | []>
  implements IGasPriceSource<MergeGasSpeedsFromSources<Sources>>
{
  constructor(private readonly sources: Sources) {}

  supportedSpeeds(): ('standard' | MergeGasSpeedsFromSources<Sources>)[] {
    return [...new Set(this.sources.flatMap((source) => source.supportedSpeeds()))];
  }

  supportedChains(): ChainId[] {
    return chainsUnion(this.sources.map((source) => source.supportedChains()));
  }

  getGasPrice(chainId: ChainId) {
    const source = this.sources.find((source) => source.supportedChains().includes(chainId));
    if (!source) throw new Error(`Chain with id ${chainId} not supported`);
    return source.getGasPrice(chainId);
  }
}
