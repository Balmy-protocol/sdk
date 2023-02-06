import { ChainId } from '@types';
import { providers } from 'ethers';
import { IProviderSource } from '../types';

export class UpdatableProviderSource implements IProviderSource {
  constructor(private provider: IProviderSource) {}

  supportedChains(): ChainId[] {
    return this.provider.supportedChains();
  }

  getProvider({ chainId }: { chainId: ChainId }): providers.BaseProvider {
    return this.provider.getProvider({ chainId });
  }

  update(provider: IProviderSource) {
    this.provider = provider;
  }
}
