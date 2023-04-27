import { ChainId } from '@types';
import { Transport } from 'viem';
import { IProviderSource } from '../types';

export class UpdatableProviderSource implements IProviderSource {
  constructor(private readonly underlying: () => IProviderSource | undefined) {}

  supportedClients() {
    return this.underlying()?.supportedClients() ?? {};
  }

  getEthersProvider({ chainId }: { chainId: ChainId }) {
    const provider = this.underlying();
    if (!provider) {
      throw new Error(`Provider is not set yet`);
    }
    return provider.getEthersProvider({ chainId });
  }

  getViemTransport({ chainId }: { chainId: ChainId }): Transport {
    throw new Error('We do not support updatable providers for viem at the moment');
  }
}
