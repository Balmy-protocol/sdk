import { Chains } from '@chains';
import { ChainId } from '@types';
import { BaseHttpProvider } from './base/base-http-provider';

const SUPPORTED_CHAINS: Record<ChainId, string> = {
  [Chains.ETHEREUM.chainId]: 'https://eth.api.onfinality.io/public',
  [Chains.ETHEREUM_SEPOLIA.chainId]: 'https://eth-sepolia.api.onfinality.io/public',
  [Chains.BNB_CHAIN.chainId]: 'https://bnb.api.onfinality.io/public',
  [Chains.POLYGON.chainId]: 'https://polygon.api.onfinality.io/public',
  [Chains.POLYGON_MUMBAI.chainId]: 'https://polygon-mumbai.api.onfinality.io/public',
  [Chains.ARBITRUM.chainId]: 'https://arbitrum.api.onfinality.io/public',
  [Chains.OPTIMISM.chainId]: 'https://optimism.api.onfinality.io/public',
  [Chains.BASE.chainId]: 'https://base.api.onfinality.io/public',
  [Chains.FANTOM.chainId]: 'https://fantom.api.onfinality.io/public',
  [Chains.AVALANCHE.chainId]: 'https://avalanche.api.onfinality.io/public/ext/bc/C',
  [Chains.GNOSIS.chainId]: 'https://gnosis.api.onfinality.io/public',
  [Chains.KAIA.chainId]: 'https://klaytn.api.onfinality.io/public',
  [Chains.CELO.chainId]: 'https://celo.api.onfinality.io/public',
  [Chains.FUSE.chainId]: 'https://fuse.api.onfinality.io/public',
  [Chains.KAVA.chainId]: 'https://kava.api.onfinality.io/public',
  [Chains.METIS_ANDROMEDA.chainId]: 'https://metis.api.onfinality.io/public',
  [Chains.MOONBEAM.chainId]: 'https://moonbeam.api.onfinality.io/public',
  [Chains.MOONRIVER.chainId]: 'https://moonriver.api.onfinality.io/public',
  [Chains.ASTAR.chainId]: 'https://astar.api.onfinality.io/public',
};

export class OnFinalityProviderSource extends BaseHttpProvider {
  private readonly supported: ChainId[];

  constructor(private readonly key?: string, onChains?: ChainId[]) {
    super();
    this.supported = onChains ?? onFinalitySupportedChains();
  }

  supportedChains(): ChainId[] {
    return this.supported;
  }

  protected calculateUrl(chainId: ChainId): string {
    return buildOnFinalityRPCUrl({ chainId, apiKey: this.key });
  }
}

export function buildOnFinalityRPCUrl({ chainId, apiKey }: { chainId: ChainId; apiKey?: string }) {
  const publicUrl = SUPPORTED_CHAINS[chainId];
  return apiKey ? publicUrl.replace('/public', '') + `/rpc?apikey=${apiKey}` : publicUrl;
}

export function onFinalitySupportedChains(): ChainId[] {
  return Object.keys(SUPPORTED_CHAINS).map(Number);
}
