import { ChainId } from '@types';
import { providers } from 'ethers';
import { IProviderSource } from '../types';
import { Transport } from 'viem';

export class EthersProviderSource implements IProviderSource {
  constructor(private readonly provider: providers.BaseProvider) {}

  supportedClients() {
    return { [this.provider.network.chainId]: { ethers: true, viem: false } };
  }

  getEthersProvider({ chainId }: { chainId: ChainId }): providers.BaseProvider {
    return this.provider;
  }

  getViemTransport(_: { chainId: number }): Transport {
    throw new Error('Not supported');
  }
}
