import { ChainId } from '@types';
import { providers } from 'ethers';
import { IProviderSource } from '../types';

export class UpdatableEthersProviderSource implements IProviderSource {
  constructor(private readonly provider: () => providers.BaseProvider | undefined) {}

  supportedChains(): ChainId[] {
    const provider = this.provider();
    return provider ? [provider.network.chainId] : [];
  }

  getProvider({ chainId }: { chainId: ChainId }): providers.BaseProvider {
    if (this.supportedChains().includes(chainId)) {
      return this.provider()!;
    }
    throw new Error(`Provider is not set or it does not support the chain ${chainId}`);
  }
}
