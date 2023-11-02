import { Chains } from '@chains';
import { ChainId } from '@types';
import { BaseHttpProvider } from './base/base-http-provider';

const SUPPORTED_CHAINS: Record<ChainId, string> = {
  [Chains.ETHEREUM.chainId]: 'https://eth-mainnet.nodereal.io/v1/',
  [Chains.ETHEREUM_GOERLI.chainId]: 'https://eth-goerli.nodereal.io/v1/',
  [Chains.BNB_CHAIN.chainId]: 'https://bsc-mainnet.nodereal.io/v1/',
  [Chains.POLYGON.chainId]: 'https://polygon-mainnet.nodereal.io/v1/',
  [Chains.OPTIMISM.chainId]: 'https://opt-mainnet.nodereal.io/v1/',
};

export class NodeRealProviderSource extends BaseHttpProvider {
  private readonly supported: ChainId[];

  constructor(private readonly key: string, onChains?: ChainId[]) {
    super();
    this.supported = onChains ?? Object.keys(SUPPORTED_CHAINS).map(Number);
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
