import { ChainId } from '@types';
import { IProviderSource } from '../types';
import { FallbackProvider } from '@ethersproject/providers';
import { FallbackTransportConfig, fallback } from 'viem';
import { combineClientSupport, sourcesWithSupport } from './utils';

export type FallbackProviderSourceConfig = {
  ethers?: { quorum?: number; prioritizeByOrder?: boolean };
  viem?: Pick<FallbackTransportConfig, 'rank' | 'retryCount' | 'retryDelay'>;
};
export class FallbackSource implements IProviderSource {
  constructor(private readonly sources: IProviderSource[], private readonly config: FallbackProviderSourceConfig | undefined) {
    if (sources.length === 0) throw new Error('Need at least one source to setup the provider source');
  }

  supportedClients() {
    return combineClientSupport(this.sources);
  }

  getEthersProvider({ chainId }: { chainId: ChainId }) {
    const sources = sourcesWithSupport(chainId, this.sources, 'ethers');
    if (sources.length === 0) throw new Error(`Chain with id ${chainId} not supported`);
    const config = sources.map((source, i) => ({
      provider: source.getEthersProvider({ chainId }),
      priority: this.config?.ethers?.prioritizeByOrder === false ? 0 : i,
    }));
    return new FallbackProvider(config, this.config?.ethers?.quorum);
  }

  getViemTransport({ chainId }: { chainId: ChainId }) {
    const sources = sourcesWithSupport(chainId, this.sources, 'viem');
    if (sources.length === 0) throw new Error(`Chain with id ${chainId} not supported`);
    const transports = sources.map((source) => source.getViemTransport({ chainId }));
    return fallback(transports, this.config?.viem);
  }
}
