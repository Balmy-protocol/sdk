import { ChainId } from '@types';
import { BaseProvider } from '@ethersproject/providers';
import { IProviderSource } from '../types';
import { Transport } from 'viem';

export class EthersProviderSource implements IProviderSource {
  constructor(private readonly provider: BaseProvider) {}

  supportedClients() {
    return { [this.provider.network.chainId]: { ethers: true, viem: false } };
  }

  getEthersProvider({ chainId }: { chainId: ChainId }): BaseProvider {
    return this.provider;
  }

  getViemTransport(_: { chainId: number }): Transport {
    throw new Error('Not supported');
  }
}
