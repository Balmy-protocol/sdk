import { providers } from 'ethers';
import { chainsUnion } from '@chains';
import { ChainId } from '@types';
import { IProviderSource } from '../types';
import { FallbackProvider } from '@ethersproject/providers';

// This source will take a list of sources, sorted by priority, and use Ether's fallback
// provider on all of them (taking the priority into account)
export class FallbackSource implements IProviderSource {
  constructor(private readonly sources: IProviderSource[]) {
    if (sources.length === 0) throw new Error('Need at least one source to setup the provider source');
  }

  supportedChains(): ChainId[] {
    return chainsUnion(this.sources.map((source) => source.supportedChains()));
  }

  getProvider({ chainId }: { chainId: ChainId }): providers.BaseProvider {
    const sources = this.sources.filter((source) => source.supportedChains().includes(chainId));
    if (sources.length === 0) throw new Error(`Chain with id ${chainId} not supported`);
    const config = sources.map((source, i) => ({ provider: source.getProvider({ chainId }), priority: i }));
    return new FallbackProvider(config);
  }
}
