import { chainsUnion } from '@chains';
import { ChainId } from '@types';
import { IGasPriceSource, MergeGasSpeedSupportRecord } from '../types';
import { combineSupportedSpeeds } from './utils';

// This source will take a list of sources, sorted by priority, and use the first one possible
// that supports the given chain
export class PrioritizedGasPriceSourceCombinator<Sources extends IGasPriceSource<any>[] | []>
  implements IGasPriceSource<MergeGasSpeedSupportRecord<Sources>>
{
  constructor(private readonly sources: Sources) {}

  supportedSpeeds(): MergeGasSpeedSupportRecord<Sources> {
    return combineSupportedSpeeds(this.sources);
  }

  supportedChains(): ChainId[] {
    return chainsUnion(this.sources.map((source) => source.supportedChains()));
  }

  getGasPrice({ chainId }: { chainId: ChainId }) {
    const source = this.sources.find((source) => source.supportedChains().includes(chainId));
    if (!source) throw new Error(`Chain with id ${chainId} not supported`);
    return source.getGasPrice({ chainId });
  }
}
