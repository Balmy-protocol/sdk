import { PublicClient, Transport, createPublicClient } from 'viem';
import { ChainId } from '@types';
import { IProviderService, IProviderSource } from './types';

export class ProviderService implements IProviderService {
  // Viem transports have a lot of state and they even do some polling at regular intervals
  // That's why we'll only create one transport per chain, and then re-use it
  private readonly viemTransports: Map<ChainId, Transport> = new Map();

  constructor(private readonly source: IProviderSource) {}

  supportedChains(): ChainId[] {
    return this.source.supportedChains();
  }

  getEthersProvider({ chainId }: { chainId: ChainId }) {
    return this.source.getEthersProvider({ chainId });
  }

  getViemPublicClient({ chainId }: { chainId: ChainId }): PublicClient {
    if (!this.viemTransports.has(chainId)) {
      const transport = this.source.getViemTransport({ chainId });
      this.viemTransports.set(chainId, transport);
    }
    return createPublicClient({ transport: this.viemTransports.get(chainId)! });
  }
}
