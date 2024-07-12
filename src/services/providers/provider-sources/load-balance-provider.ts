import { ChainId } from '@types';
import { IProviderSource } from '../types';
import { chainsUnion } from '@chains';
import { loadBalance, LoadBalanceConfig } from '@services/transports';

export type LoadBalanceSourceConfig = LoadBalanceConfig;
export class LoadBalanceSource implements IProviderSource {
  constructor(private readonly sources: IProviderSource[], private readonly config: LoadBalanceConfig | undefined) {
    if (sources.length === 0) throw new Error('Need at least one source to setup the provider source');
  }

  supportedChains() {
    return chainsUnion(this.sources.map((source) => source.supportedChains()));
  }

  getViemTransport({ chainId }: { chainId: ChainId }) {
    const transports = this.sources
      .filter((source) => source.supportedChains().includes(chainId))
      .map((source) => source.getViemTransport({ chainId }));
    if (transports.length === 0) throw new Error(`Chain with id ${chainId} not supported`);
    return loadBalance(transports, this.config);
  }
}
