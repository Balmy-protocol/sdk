import { chainsUnion } from '@chains';
import { ChainId } from '@types';
import { IProviderSource } from '../types';

// This source will take a list of sources, sorted by priority, and use the first one possible
// that supports the given chain
export class PrioritizedProviderSourceCombinator implements IProviderSource {
  constructor(private readonly sources: IProviderSource[]) {
    if (sources.length === 0) throw new Error('Need at least one source to setup the provider source');
  }

  supportedChains(): ChainId[] {
    return chainsUnion(this.sources.map((source) => source.supportedChains()));
  }

  getEthersProvider({ chainId }: { chainId: ChainId }) {
    const source = this.sources.find((source) => source.supportedChains().includes(chainId));
    if (!source) throw new Error(`Chain with id ${chainId} not supported`);
    return source.getEthersProvider({ chainId });
  }

  getViemTransport({ chainId }: { chainId: ChainId }) {
    const source = this.sources.find((source) => source.supportedChains().includes(chainId));
    if (!source) throw new Error(`Chain with id ${chainId} not supported`);
    return source.getViemTransport({ chainId });
  }
}
