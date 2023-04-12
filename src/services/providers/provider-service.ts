import { ChainId } from '@types';
import { IProviderService, IProviderSource } from './types';
import { createPublicClient } from 'viem';

export class ProviderService implements IProviderService {
  constructor(private readonly source: IProviderSource) {}

  supportedChains(): ChainId[] {
    return this.source.supportedChains();
  }

  getEthersProvider({ chainId }: { chainId: ChainId }) {
    return this.source.getEthersProvider({ chainId });
  }

  getViemClient({ chainId }: { chainId: ChainId }) {
    const transport = this.source.getViemTransport({ chainId });
    return createPublicClient({ transport });
  }
}
