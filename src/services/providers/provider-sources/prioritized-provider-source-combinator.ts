import { ChainId } from '@types';
import { IProviderSource } from '../types';
import { combineClientSupport, sourcesWithSupport } from './utils';

// This source will take a list of sources, sorted by priority, and use the first one possible
// that supports the given chain
export class PrioritizedProviderSourceCombinator implements IProviderSource {
  constructor(private readonly sources: IProviderSource[]) {
    if (sources.length === 0) throw new Error('Need at least one source to setup the provider source');
  }

  supportedClients() {
    return combineClientSupport(this.sources);
  }

  getEthersProvider({ chainId }: { chainId: ChainId }) {
    const sources = sourcesWithSupport(chainId, this.sources, 'ethers');
    if (sources.length === 0) throw new Error(`Chain with id ${chainId} not supported`);
    return sources[0].getEthersProvider({ chainId });
  }

  getViemTransport({ chainId }: { chainId: ChainId }) {
    const sources = sourcesWithSupport(chainId, this.sources, 'ethers');
    if (sources.length === 0) throw new Error(`Chain with id ${chainId} not supported`);
    return sources[0].getViemTransport({ chainId });
  }
}
