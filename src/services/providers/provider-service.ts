import { PublicClient, Transport, createPublicClient } from 'viem';
import { ChainId } from '@types';
import { IProviderService, IProviderSource } from './types';
import { getViemChain } from './utils';

export class ProviderService implements IProviderService {
  // Viem clients have a lot of state and they even do some polling at regular intervals
  // That's why we'll only create one client per chain, and then re-use it
  private readonly viemPublicClients: Map<ChainId, PublicClient> = new Map();

  constructor(private readonly source: IProviderSource) {}

  supportedChains(): ChainId[] {
    return this.source.supportedChains();
  }

  getViemPublicClient({ chainId }: { chainId: ChainId }): PublicClient {
    if (!this.viemPublicClients.has(chainId)) {
      const transport = this.getViemTransport({ chainId });
      const chain = getViemChain(chainId);
      const client = createPublicClient({ chain, transport });
      this.viemPublicClients.set(chainId, client as PublicClient);
    }
    return this.viemPublicClients.get(chainId)!;
  }

  getViemTransport({ chainId }: { chainId: number }): Transport {
    return this.source.getViemTransport({ chainId });
  }
}
