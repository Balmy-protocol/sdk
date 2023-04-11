import { ChainId } from '@types';
import { providers } from 'ethers';
import { IProviderSource } from '../types';

export class UpdatableProviderSource implements IProviderSource {
  constructor(private readonly underlying: () => IProviderSource | undefined) {}

  supportedChains(): ChainId[] {
    return this.underlying()?.supportedChains() ?? [];
  }

  getEthersProvider({ chainId }: { chainId: ChainId }): providers.BaseProvider {
    const provider = this.underlying();
    if (!provider) {
      throw new Error(`Provider is not set yet`);
    }
    return provider.getEthersProvider({ chainId });
  }
}
