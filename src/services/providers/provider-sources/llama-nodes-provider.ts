import { Chains } from '@chains';
import { ChainId } from '@types';
import { BaseHttpProvider } from './base/base-http-provider';

const SUPPORTED_CHAINS: Record<ChainId, string> = {
  [Chains.ETHEREUM.chainId]: 'https://eth.llamarpc.com',
  [Chains.POLYGON.chainId]: 'https://polygon.llamarpc.com',
};

export class LlamaNodesProviderSource extends BaseHttpProvider {
  constructor(private readonly key?: string) {
    super();
  }

  supportedChains(): ChainId[] {
    return Object.keys(SUPPORTED_CHAINS).map(Number);
  }

  protected calculateUrl(chainId: number): string {
    let url = SUPPORTED_CHAINS[chainId];
    if (this.key) {
      url += `/rpc/${this.key}`;
    }
    return url;
  }
}
