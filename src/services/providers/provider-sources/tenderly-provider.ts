import { Chains } from '@chains';
import { ChainId } from '@types';
import { BaseHttpProvider, HttpProviderConfig } from './base/base-http-provider';

const SUPPORTED_CHAINS: Record<ChainId, string> = {
  [Chains.ETHEREUM.chainId]: 'https://mainnet.gateway.tenderly.co',
  [Chains.ETHEREUM_SEPOLIA.chainId]: 'https://sepolia.gateway.tenderly.co',
  [Chains.POLYGON.chainId]: 'https://polygon.gateway.tenderly.co',
  [Chains.POLYGON_MUMBAI.chainId]: 'https://polygon-mumbai.gateway.tenderly.co',
  [Chains.OPTIMISM.chainId]: 'https://optimism.gateway.tenderly.co',
  [Chains.BASE.chainId]: 'https://base.gateway.tenderly.co',
  [Chains.ARBITRUM.chainId]: 'https://arbitrum.gateway.tenderly.co',
  [Chains.BOBA.chainId]: 'https://boba-ethereum.gateway.tenderly.co',
  [Chains.BLAST.chainId]: 'https://blast.gateway.tenderly.co',
  [Chains.MODE.chainId]: 'https://mode.gateway.tenderly.co',
  [Chains.AVALANCHE.chainId]: 'https://avalanche.gateway.tenderly.co',
  [Chains.LINEA.chainId]: 'https://linea.gateway.tenderly.co',
  [Chains.SONIC.chainId]: 'https://sonic.gateway.tenderly.co',
  [Chains.MANTLE.chainId]: 'https://mantle.gateway.tenderly.co',
};

export class TenderlyProviderSource extends BaseHttpProvider {
  private readonly supported: ChainId[];
  private readonly key: string | undefined;

  constructor({ key, onChains, config }: { key?: string; onChains?: ChainId[]; config?: HttpProviderConfig }) {
    super(config);
    this.key = key;
    this.supported = onChains ?? tenderlySupportedChains();
  }

  supportedChains(): ChainId[] {
    return this.supported;
  }

  protected calculateUrl(chainId: ChainId): string {
    return buildTenderlyRPCUrl({ chainId, apiKey: this.key });
  }
}

export function buildTenderlyRPCUrl({ chainId, apiKey }: { chainId: ChainId; apiKey?: string }) {
  let url = SUPPORTED_CHAINS[chainId];
  if (apiKey) {
    url += `/${apiKey}`;
  }
  return url;
}

export function tenderlySupportedChains(): ChainId[] {
  return Object.keys(SUPPORTED_CHAINS).map(Number);
}
