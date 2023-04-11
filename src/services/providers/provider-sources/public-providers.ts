import { getAllChains } from '@chains';
import { ChainId, Chain } from '@types';
import { providers } from 'ethers';
import { IProviderSource } from '../types';
import { buildEthersProviderForHttpSource } from './base/base-http-provider';

export class PublicRPCsSource implements IProviderSource {
  private readonly publicRPCs: Record<ChainId, string[]>;

  constructor(publicRPCs?: Record<ChainId, string[]>) {
    if (publicRPCs) {
      this.publicRPCs = publicRPCs;
    } else {
      // If not set, default to known chains
      this.publicRPCs = Object.fromEntries(
        getAllChains()
          .filter((chain): chain is Chain & { publicRPCs: string[] } => chain.publicRPCs.length > 0)
          .map(({ chainId, publicRPCs }) => [chainId, publicRPCs])
      );
    }
  }

  supportedChains(): ChainId[] {
    return Object.keys(this.publicRPCs).map((chainId) => parseInt(chainId));
  }

  getEthersProvider({ chainId }: { chainId: ChainId }): providers.BaseProvider {
    const publicRPCs = this.publicRPCs[chainId];
    if (!publicRPCs) throw new Error(`Unsupported chain with id ${chainId}`);
    const config = publicRPCs.map((url, i) => ({
      provider: buildEthersProviderForHttpSource(url, chainId),
      priority: i,
    }));
    return new providers.FallbackProvider(config, 1);
  }
}
