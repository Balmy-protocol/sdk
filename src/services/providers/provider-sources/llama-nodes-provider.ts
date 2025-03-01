import { Chains } from '@chains';
import { ChainId } from '@types';
import { BaseHttpProvider, HttpProviderConfig } from './base/base-http-provider';

const SUPPORTED_CHAINS: Record<ChainId, string> = {
  [Chains.ETHEREUM.chainId]: 'https://eth.llamarpc.com',
  [Chains.POLYGON.chainId]: 'https://polygon.llamarpc.com',
  [Chains.BNB_CHAIN.chainId]: 'https://binance.llamarpc.com',
  [Chains.ARBITRUM.chainId]: 'https://arbitrum.llamarpc.com',
  [Chains.OPTIMISM.chainId]: 'https://optimism.llamarpc.com',
  [Chains.BASE.chainId]: 'https://base.llamarpc.com',
};

export class LlamaNodesProviderSource extends BaseHttpProvider {
  private readonly supported: ChainId[];
  private readonly key: string | undefined;

  constructor({ key, onChains, config }: { key?: string; onChains?: ChainId[]; config?: HttpProviderConfig }) {
    super(config);
    this.key = key;
    this.supported = onChains ?? llamaNodesSupportedChains();
  }

  supportedChains(): ChainId[] {
    return this.supported;
  }

  protected calculateUrl(chainId: number): string {
    return buildLlamaNodesRPCUrl({ chainId, apiKey: this.key });
  }
}

export function buildLlamaNodesRPCUrl({ chainId, apiKey }: { chainId: ChainId; apiKey?: string }) {
  let url = SUPPORTED_CHAINS[chainId];
  if (apiKey) {
    url += `/rpc/${apiKey}`;
  }
  return url;
}

export function llamaNodesSupportedChains(): ChainId[] {
  return Object.keys(SUPPORTED_CHAINS).map(Number);
}
