import { chainsUnion } from '@chains';
import { ChainId } from '@types';
import { ArrayTwoOrMore } from '@utility-types';
import { IGasPriceSource } from '../types';

// This source will take a list of sources, sorted by priority, and use the first one possible
// that supports the given chain
export class PrioritizedGasPriceSourceCombinator implements IGasPriceSource {
  constructor(private readonly sources: ArrayTwoOrMore<IGasPriceSource>) {}

  supportedChains(): ChainId[] {
    return chainsUnion(this.sources.map((source) => source.supportedChains()));
  }

  getGasPrice(chainId: ChainId) {
    const source = this.sources.find((source) => source.supportedChains().includes(chainId));
    if (!source) throw new Error(`Chain with id ${chainId} not supported`);
    return source.getGasPrice(chainId);
  }
}
