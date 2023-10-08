import { Chains } from '@chains';
import { ChainId } from '@types';
import { BaseHttpProvider } from './base/base-http-provider';

const SUPPORTED_CHAINS: Record<ChainId, string> = {
  [Chains.ETHEREUM.chainId]: 'https://eth.llamarpc.com',
  [Chains.POLYGON.chainId]: 'https://polygon.llamarpc.com',
  [Chains.BNB_CHAIN.chainId]: 'https://binance.llamarpc.com',
  [Chains.ARBITRUM.chainId]: 'https://arbitrum.llamarpc.com',
  [Chains.OPTIMISM.chainId]: 'https://optimism.llamarpc.com',
};

export class LlamaNodesProviderSource extends BaseHttpProvider {
  private readonly supported: ChainId[];

  constructor(private readonly key?: string, onChains?: ChainId[]) {
    super();
    this.supported = onChains ?? Object.keys(SUPPORTED_CHAINS).map(Number);
  }

  supportedChains(): ChainId[] {
    return this.supported;
  }

  protected calculateUrl(chainId: number): string {
    let url = SUPPORTED_CHAINS[chainId];
    if (this.key) {
      url += `/rpc/${this.key}`;
    }
    return url;
  }
}
