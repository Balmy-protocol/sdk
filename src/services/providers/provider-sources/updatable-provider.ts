import { ChainId } from '@types';
import { IProviderSource } from '../types';

export class UpdatableProviderSource implements IProviderSource {
  constructor(private readonly underlying: () => IProviderSource | undefined) {}

  supportedChains(): ChainId[] {
    return this.underlying()?.supportedChains() ?? [];
  }

  getEthersProvider({ chainId }: { chainId: ChainId }) {
    const provider = this.underlying();
    if (!provider) {
      throw new Error(`Provider is not set yet`);
    }
    return provider.getEthersProvider({ chainId });
  }

  getViemTransport({ chainId }: { chainId: ChainId }) {
    const provider = this.underlying();
    if (!provider) {
      throw new Error(`Provider is not set yet`);
    }
    return provider.getViemTransport({ chainId });
  }
}
