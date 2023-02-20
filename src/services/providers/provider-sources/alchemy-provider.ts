import { Chains } from '@chains';
import { buildAlchemyProvider } from '@shared/alchemy-rpc';
import { ChainId } from '@types';
import { providers } from 'ethers';
import { IProviderSource } from '../types';

const DEFAULT_CHAINS: ChainId[] = [Chains.ETHEREUM, Chains.POLYGON, Chains.ARBITRUM, Chains.OPTIMISM, Chains.ASTAR].map(
  ({ chainId }) => chainId
);

export class AlchemyProviderSource implements IProviderSource {
  private readonly chains: ChainId[];

  constructor(private readonly key: string, private readonly protocol: 'https' | 'wss', chains?: ChainId[]) {
    this.chains = chains ?? DEFAULT_CHAINS;
  }

  supportedChains(): ChainId[] {
    return this.chains;
  }

  getProvider({ chainId }: { chainId: ChainId }): providers.BaseProvider {
    return buildAlchemyProvider(this.key, this.protocol, chainId);
  }
}
