import { WebSocketProvider } from '@ethersproject/providers';
import { ChainId } from '@types';
import { ArrayOneOrMore } from '@utility-types';
import { providers } from 'ethers';
import { IProviderSource } from '../types';

export class WebSocketProviderSource implements IProviderSource {
  private readonly chains: ChainId[];

  constructor(private readonly url: string, supportedChains: ArrayOneOrMore<ChainId>) {
    this.chains = supportedChains;
  }

  supportedChains(): ChainId[] {
    return this.chains;
  }

  getEthersProvider({ chainId }: { chainId: ChainId }): providers.BaseProvider {
    return new WebSocketProvider(this.url, chainId);
  }
}
