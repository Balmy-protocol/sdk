import { Chains } from '@chains';
import { ChainId } from '@types';
import { BaseHttpProvider, HttpProviderConfig } from './base/base-http-provider';

const SUPPORTED_CHAINS: Record<ChainId, string> = {
  [Chains.ETHEREUM.chainId]: 'https://mainnet.infura.io/v3/',
  [Chains.ETHEREUM_GOERLI.chainId]: 'https://goerli.infura.io/v3/',
  [Chains.ETHEREUM_SEPOLIA.chainId]: 'https://sepolia.infura.io/v3/',
  [Chains.ARBITRUM.chainId]: 'https://arbitrum-mainnet.infura.io/v3/',
  [Chains.AURORA.chainId]: 'https://aurora-mainnet.infura.io/v3/',
  [Chains.AVALANCHE.chainId]: 'https://avalanche-mainnet.infura.io/v3/',
  [Chains.CELO.chainId]: 'https://celo-mainnet.infura.io/v3/',
  [Chains.OPTIMISM.chainId]: 'https://optimism-mainnet.infura.io/v3/',
  [Chains.POLYGON.chainId]: 'https://polygon-mainnet.infura.io/v3/',
  [Chains.POLYGON_MUMBAI.chainId]: 'https://polygon-mumbai.infura.io/v3/',
};

export class InfuraProviderSource extends BaseHttpProvider {
  private readonly supported: ChainId[];
  private readonly key: string;

  constructor({ key, onChains, config }: { key: string; onChains?: ChainId[]; config?: HttpProviderConfig }) {
    super(config);
    this.key = key;
    this.supported = onChains ?? infuraSupportedChains();
  }

  supportedChains(): ChainId[] {
    return this.supported;
  }

  protected calculateUrl(chainId: number): string {
    return buildInfuraRPCUrl({ chainId, apiKey: this.key });
  }
}

export function buildInfuraRPCUrl({ chainId, apiKey }: { chainId: ChainId; apiKey: string }) {
  return SUPPORTED_CHAINS[chainId] + apiKey;
}

export function infuraSupportedChains(): ChainId[] {
  return Object.keys(SUPPORTED_CHAINS).map(Number);
}
