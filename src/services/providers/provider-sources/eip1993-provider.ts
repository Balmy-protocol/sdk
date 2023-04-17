import { ExternalProvider, Web3Provider } from '@ethersproject/providers';
import { Transport } from 'viem';
import { ChainId } from '@types';
import { IProviderSource } from '../types';

export type EIP1993Provider = Required<Pick<ExternalProvider, 'request'>>;
export class EIP1993ProviderSource implements IProviderSource {
  private readonly ethersProvider: Web3Provider;

  constructor(provider: EIP1993Provider) {
    this.ethersProvider = new Web3Provider(provider);
  }

  supportedChains(): ChainId[] {
    return [this.ethersProvider.network.chainId];
  }

  getEthersProvider({ chainId }: { chainId: ChainId }) {
    return this.ethersProvider;
  }

  getViemTransport({ chainId }: { chainId: ChainId }): Transport {
    throw new Error('We do not support EIP-1993 providers for viem at the moment');
  }
}
