import { Networks } from '@networks';
import { Network } from '@types';
import { providers } from 'ethers';
import { IProviderSource } from '../types';

export class SingleProviderSource implements IProviderSource {
  private readonly network: Network;

  constructor(private readonly provider: providers.BaseProvider, network?: Network) {
    if (network && network.chainId !== this.provider.network.chainId) throw new Error('Invalid network');
    this.network = network ?? Networks.byKeyOrFail(this.provider.network.chainId);
  }

  supportedNetworks(): Network[] {
    return [this.network];
  }

  getProvider(network: Network): providers.BaseProvider {
    return this.provider;
  }
}
