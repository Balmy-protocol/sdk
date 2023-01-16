import { ChainId } from '@types';
import { providers } from 'ethers';
import { IProviderSource } from '../types';

export class SingleProviderSource implements IProviderSource {
  constructor(private readonly provider: providers.BaseProvider) {}

  supportedChains(): ChainId[] {
    return [this.provider.network.chainId];
  }

  getProvider(chainId: ChainId): providers.BaseProvider {
    return this.provider;
  }
}
