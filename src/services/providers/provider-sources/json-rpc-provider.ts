import { JsonRpcProvider } from '@ethersproject/providers';
import { ChainId } from '@types';
import { ArrayOneOrMore } from '@utility-types';
import { providers } from 'ethers';
import { IProviderSource } from '../types';

export class JsonRPCProviderSource implements IProviderSource {
  private readonly chains: ChainId[];

  constructor(private readonly url: string, supportedChains: ArrayOneOrMore<ChainId>) {
    this.chains = supportedChains;
  }

  supportedChains(): ChainId[] {
    return this.chains;
  }

  getProvider({ chainId }: { chainId: ChainId }): providers.BaseProvider {
    return new JsonRpcProvider(this.url, chainId);
  }
}
