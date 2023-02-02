import { Chains } from '@chains';
import { InfuraProvider } from '@ethersproject/providers';
import { ChainId } from '@types';
import { providers } from 'ethers';
import { IProviderSource } from '../types';

const DEFAULT_CHAINS: ChainId[] = [Chains.ETHEREUM, Chains.POLYGON, Chains.ARBITRUM, Chains.OPTIMISM].map(({ chainId }) => chainId);

export class InfuraProviderSource implements IProviderSource {
  private readonly chains: ChainId[];

  constructor(private readonly key: string, chains?: ChainId[]) {
    this.chains = chains ?? DEFAULT_CHAINS;
  }

  supportedChains(): ChainId[] {
    return this.chains;
  }

  getProvider(chainId: ChainId): providers.BaseProvider {
    return new InfuraProvider(chainId, this.key);
  }
}
