import { Chains } from '@chains';
import { AlchemyProvider } from '@ethersproject/providers';
import { ChainId } from '@types';
import { providers } from 'ethers';
import { IProviderSource } from '../types';

const DEFAULT_CHAINS: ChainId[] = [Chains.ETHEREUM, Chains.POLYGON, Chains.ARBITRUM, Chains.OPTIMISM, Chains.ASTAR].map(
  ({ chainId }) => chainId
);

export class AlchemyProviderSource implements IProviderSource {
  private readonly chains: ChainId[];

  constructor(private readonly key: string, chains?: ChainId[]) {
    this.chains = chains ?? DEFAULT_CHAINS;
  }

  supportedChains(): ChainId[] {
    return this.chains;
  }

  getProvider({ chainId }: { chainId: ChainId }): providers.BaseProvider {
    return new AlchemyProvider(chainId, this.key);
  }
}
