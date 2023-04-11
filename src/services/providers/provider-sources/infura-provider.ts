import { Chains } from '@chains';
import { ChainId } from '@types';
import { BaseHttpProvider } from './base/base-http-provider';

const SUPPORTED_CHAINS: Record<ChainId, string> = {
  [Chains.ETHEREUM.chainId]: 'https://mainnet.infura.io/v3/',
  [Chains.ETHEREUM_GOERLI.chainId]: 'https://goerli.infura.io/v3/',
  [Chains.ETHEREUM_SEPOLIA.chainId]: 'https://sepolia.infura.io/v3/',
  [Chains.ARBITRUM.chainId]: 'https://arbitrum-mainnet.infura.io/v3/',
  [Chains.AURORA.chainId]: 'https://aurora-mainnet.infura.io/v3/',
  [Chains.AVALANCHE.chainId]: 'https://avalanche-mainnet.infura.io/v3/',
  [Chains.BNB_CHAIN.chainId]: 'https://bnbsmartchain-mainnet.infura.io/v3/',
  [Chains.CELO.chainId]: 'https://celo-mainnet.infura.io/v3/',
  [Chains.OPTIMISM.chainId]: 'https://optimism-mainnet.infura.io/v3/',
  [Chains.POLYGON.chainId]: 'https://polygon-mainnet.infura.io/v3/',
  [Chains.POLYGON_MUMBAI.chainId]: 'https://polygon-mumbai.infura.io/v3/',
};

export class InfuraProviderSource extends BaseHttpProvider {
  constructor(private readonly key: string) {
    super();
  }

  supportedChains(): ChainId[] {
    return Object.keys(SUPPORTED_CHAINS).map(Number);
  }

  protected calculateUrl(chainId: number): string {
    return SUPPORTED_CHAINS[chainId] + this.key;
  }
}
