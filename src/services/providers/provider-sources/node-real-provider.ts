import { Chains } from '@chains';
import { ChainId } from '@types';
import { BaseHttpProvider, HttpProviderConfig } from './base/base-http-provider';

const SUPPORTED_CHAINS: Record<ChainId, string> = {
  [Chains.ETHEREUM.chainId]: 'https://eth-mainnet.nodereal.io/v1/',
  [Chains.ETHEREUM_GOERLI.chainId]: 'https://eth-goerli.nodereal.io/v1/',
  [Chains.BNB_CHAIN.chainId]: 'https://bsc-mainnet.nodereal.io/v1/',
  [Chains.POLYGON.chainId]: 'https://polygon-mainnet.nodereal.io/v1/',
  [Chains.OPTIMISM.chainId]: 'https://opt-mainnet.nodereal.io/v1/',
};

export class NodeRealProviderSource extends BaseHttpProvider {
  private readonly supported: ChainId[];
  private readonly key: string;

  constructor({ key, onChains, config }: { key: string; onChains?: ChainId[]; config?: HttpProviderConfig }) {
    super(config);
    this.key = key;
    this.supported = onChains ?? nodeRealSupportedChains();
  }

  supportedChains(): ChainId[] {
    return this.supported;
  }

  protected calculateUrl(chainId: number): string {
    return buildNodeRealRPCUrl({ chainId, apiKey: this.key });
  }
}

export function buildNodeRealRPCUrl({ chainId, apiKey }: { chainId: ChainId; apiKey: string }) {
  return SUPPORTED_CHAINS[chainId] + apiKey;
}
export function nodeRealSupportedChains(): ChainId[] {
  return Object.keys(SUPPORTED_CHAINS).map(Number);
}
