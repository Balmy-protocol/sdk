import { ChainId } from '@types';
import { providers } from 'ethers';
import { IProviderSource } from '../types';
import { ExternalProvider, Web3Provider } from '@ethersproject/providers';

export type EIP1993Provider = Pick<ExternalProvider, 'request'>;
export class EIP1993ProviderSource implements IProviderSource {
  constructor(private readonly provider: EIP1993Provider) {}

  supportedChains(): ChainId[] {
    // We know that the chain id is ignored, so we can pass whatever we want
    return [this.getEthersProvider({ chainId: 0 }).network.chainId];
  }

  getEthersProvider({ chainId }: { chainId: ChainId }): providers.BaseProvider {
    return new Web3Provider(this.provider);
  }
}
