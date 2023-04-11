import { providers } from 'ethers';
import { chainsUnion } from '@chains';
import { ChainId } from '@types';
import { IProviderSource } from '../types';
import { FallbackProvider } from '@ethersproject/providers';

export type FallbackProviderSourceConfig = { ethers?: { quorum?: number } };
export class FallbackSource implements IProviderSource {
  constructor(private readonly sources: IProviderSource[], private readonly config: FallbackProviderSourceConfig | undefined) {
    if (sources.length === 0) throw new Error('Need at least one source to setup the provider source');
  }

  supportedChains(): ChainId[] {
    return chainsUnion(this.sources.map((source) => source.supportedChains()));
  }

  getEthersProvider({ chainId }: { chainId: ChainId }): providers.BaseProvider {
    const sources = this.sources.filter((source) => source.supportedChains().includes(chainId));
    if (sources.length === 0) throw new Error(`Chain with id ${chainId} not supported`);
    const config = sources.map((source, i) => ({ provider: source.getEthersProvider({ chainId }), priority: i }));
    return new FallbackProvider(config, this.config?.ethers?.quorum);
  }
}
