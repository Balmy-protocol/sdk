import { ChainId } from '@types';
import { providers } from 'ethers';
import { IProviderSource } from '../types';
import { ExternalProvider, Web3Provider } from '@ethersproject/providers';

export type EIP1993Provider = Pick<ExternalProvider, 'request'>;
export class EIP1993ProviderSource implements IProviderSource {
  constructor(private readonly provider: EIP1993Provider) {}

  supportedChains(): ChainId[] {
    return [this.getEthersProvider({ chainId: 1 }).network.chainId];
  }

  getEthersProvider({ chainId }: { chainId: ChainId }): providers.BaseProvider {
    return new Web3Provider(this.provider);
  }
}
