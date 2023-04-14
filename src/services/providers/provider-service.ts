import { ChainId } from '@types';
import { IProviderService, IProviderSource } from './types';
import { PublicClient, createPublicClient } from 'viem';

export class ProviderService implements IProviderService {
  constructor(private readonly source: IProviderSource) {}

  supportedChains(): ChainId[] {
    return this.source.supportedChains();
  }

  getEthersProvider({ chainId }: { chainId: ChainId }) {
    return this.source.getEthersProvider({ chainId });
  }

  getViemClient({ chainId }: { chainId: ChainId }): PublicClient {
    const transport = this.source.getViemTransport({ chainId });
    return createPublicClient({ transport });
  }
}
