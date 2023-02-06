import { chainsUnion } from '@chains';
import { ChainId } from '@types';
import { IGasPriceSource, MergeGasSpeedSupportRecord } from '../types';
import { combineSupportedSpeeds } from './utils';

// This source will take a list of sources, and try to calculate the gas price on all of them, returning
// the one that resolves first
export class FastestGasPriceSourceCombinator<Sources extends IGasPriceSource<any>[] | []>
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
    const sourcesInChain = this.sources.filter((source) => source.supportedChains().includes(chainId));
    if (sourcesInChain.length === 0) throw new Error(`Chain with id ${chainId} not supported`);
    return Promise.any(sourcesInChain.map((source) => source.getGasPrice({ chainId })));
  }
}
