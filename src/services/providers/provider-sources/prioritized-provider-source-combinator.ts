import { providers } from 'ethers';
import { chainsUnion } from '@chains';
import { ChainId } from '@types';
import { ArrayTwoOrMore } from '@utility-types';
import { IProviderSource } from '../types';

// This source will take a list of sources, sorted by priority, and use the first one possible
// that supports the given chain
export class PrioritizedProviderSourceCombinator implements IProviderSource {
  constructor(private readonly sources: ArrayTwoOrMore<IProviderSource>) {}

  supportedChains(): ChainId[] {
    return chainsUnion(this.sources.map((source) => source.supportedChains()));
  }

  getProvider(chainId: ChainId): providers.BaseProvider {
    const source = this.sources.find((source) => source.supportedChains().includes(chainId));
    if (!source) throw new Error(`Chain with id ${chainId} not supported`);
    return source.getProvider(chainId);
  }
}
