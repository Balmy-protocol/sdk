import { PublicClient, createPublicClient } from 'viem';
import { ChainId } from '@types';
import { IProviderService, IProviderSource } from './types';

export class ProviderService implements IProviderService {
  // Viem clients have a lot of state and they even do some polling at regular intervals
  // That's why we'll only create one client per chain, and then re-use it
  private readonly viemPublicClients: Map<ChainId, PublicClient> = new Map();

  constructor(private readonly source: IProviderSource) {}

  supportedChains(): ChainId[] {
    return Object.entries(this.source.supportedClients())
      .filter(([chainId, support]) => support.ethers || support.viem)
      .map(([chainId]) => Number(chainId));
  }

  supportedClients() {
    return this.source.supportedClients();
  }

  getEthersProvider({ chainId }: { chainId: ChainId }) {
    return this.source.getEthersProvider({ chainId });
  }

  getViemPublicClient({ chainId }: { chainId: ChainId }): PublicClient {
    if (!this.viemPublicClients.has(chainId)) {
      const transport = this.source.getViemTransport({ chainId });
      const client = createPublicClient({ transport });
      this.viemPublicClients.set(chainId, client);
    }
    return this.viemPublicClients.get(chainId)!;
  }
}
