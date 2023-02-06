import { Chains } from '@chains';
import { ChainId, Chain } from '@types';
import { ArrayOneOrMore } from '@utility-types';
import { providers } from 'ethers';
import { IProviderSource } from '../types';

export class PublicProvidersSource implements IProviderSource {
  private readonly publicRPCs: Record<ChainId, ArrayOneOrMore<string>>;

  constructor(publicRPCs?: Record<ChainId, ArrayOneOrMore<string>>) {
    if (publicRPCs) {
      this.publicRPCs = publicRPCs;
    } else {
      // If not set, default to known chains
      this.publicRPCs = Object.fromEntries(
        Chains.getAllChains()
          .filter((chain): chain is Chain & { publicRPCs: ArrayOneOrMore<string> } => !!chain.publicRPCs && chain.publicRPCs.length > 0)
          .map(({ chainId, publicRPCs }) => [chainId, publicRPCs])
      );
    }
  }

  supportedChains(): ChainId[] {
    return Object.keys(this.publicRPCs).map((chainId) => parseInt(chainId));
  }

  getProvider({ chainId }: { chainId: ChainId }): providers.BaseProvider {
    const publicRPCs = this.publicRPCs[chainId];
    if (!publicRPCs) throw new Error(`Unsupported chain with id ${chainId}`);
    const config = publicRPCs.map((url, i) => ({
      provider: new providers.StaticJsonRpcProvider(url, chainId),
      priority: i,
    }));
    return new providers.FallbackProvider(config, 1);
  }
}
