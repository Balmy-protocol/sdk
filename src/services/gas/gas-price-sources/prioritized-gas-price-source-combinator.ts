import { chainsUnion } from '@chains';
import { ChainId } from '@types';
import { IGasPriceSource, MergeGasSpeedSupportRecord } from '../types';
import { OpenOceanGasPriceSource } from './open-ocean';
import { ProviderGasPriceSource } from './provider';

// This source will take a list of sources, sorted by priority, and use the first one possible
// that supports the given chain
export class PrioritizedGasPriceSourceCombinator<Sources extends IGasPriceSource<any>[] | []>
  implements IGasPriceSource<MergeGasSpeedSupportRecord<Sources>>
{
  constructor(private readonly sources: Sources) {}

  supportedSpeeds(): MergeGasSpeedSupportRecord<Sources> {
    const result = this.sources[0].supportedSpeeds();
    for (let i = 1; i < this.sources.length; i++) {
      const sourceSpeeds = this.sources[i].supportedSpeeds();
      for (const speed in sourceSpeeds) {
        if (result[speed] !== 'optional') {
          result[speed] = sourceSpeeds[speed];
        }
      }
      for (const speed in result) {
        if (result[speed] === 'present' && !(speed in sourceSpeeds)) {
          result[speed] = 'optional';
        }
      }
    }
    return result;
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
