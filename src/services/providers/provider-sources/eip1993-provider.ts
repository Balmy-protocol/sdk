import { ChainId } from '@types';
import { IProviderSource } from '../types';
import { ExternalProvider, Web3Provider } from '@ethersproject/providers';
import { custom } from 'viem';

export type EIP1993Provider = Required<Pick<ExternalProvider, 'request'>>;
export class EIP1993ProviderSource implements IProviderSource {
  constructor(private readonly provider: EIP1993Provider) {}

  supportedChains(): ChainId[] {
    // We know that the chain id is ignored, so we can pass whatever we want
    return [this.getEthersProvider({ chainId: 0 }).network.chainId];
  }

  getEthersProvider({ chainId }: { chainId: ChainId }) {
    return new Web3Provider(this.provider);
  }

  getViemTransport({ chainId }: { chainId: ChainId }) {
    return custom(this.provider);
  }
}
