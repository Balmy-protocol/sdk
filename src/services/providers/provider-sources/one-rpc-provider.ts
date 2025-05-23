import { Chains } from '@chains';
import { ChainId } from '@types';
import { BaseHttpProvider, HttpProviderConfig } from './base/base-http-provider';

const SUPPORTED_CHAINS: Record<ChainId, string> = {
  [Chains.ETHEREUM.chainId]: 'eth',
  [Chains.ETHEREUM_SEPOLIA.chainId]: 'sepolia',
  [Chains.BNB_CHAIN.chainId]: 'bnb',
  [Chains.POLYGON.chainId]: 'matic',
  [Chains.POLYGON_ZKEVM.chainId]: 'polygon/zkevm',
  [Chains.AVALANCHE.chainId]: 'avax/c',
  [Chains.ARBITRUM.chainId]: 'arb',
  [Chains.MOONBEAM.chainId]: 'glmr',
  [Chains.ASTAR.chainId]: 'astr',
  [Chains.OPTIMISM.chainId]: 'op',
  [Chains.FANTOM.chainId]: 'ftm',
  [Chains.CELO.chainId]: 'celo',
  [Chains.KAIA.chainId]: 'klay',
  [Chains.AURORA.chainId]: 'aurora',
  [Chains.BASE.chainId]: 'base',
  [Chains.GNOSIS.chainId]: 'gnosis',
  [Chains.OKC.chainId]: 'oktc',
  [Chains.CRONOS.chainId]: 'cro',
  [Chains.opBNB.chainId]: 'opbnb',
  [Chains.BOBA.chainId]: 'boba/eth',
  [Chains.MODE.chainId]: 'mode',
};

export class OneRPCProviderSource extends BaseHttpProvider {
  private readonly supported: ChainId[];
  private readonly key: string | undefined;

  constructor({ key, onChains, config }: { key?: string; onChains?: ChainId[]; config?: HttpProviderConfig }) {
    super(config);
    this.key = key;
    this.supported = onChains ?? oneRPCSupportedChains();
  }

  supportedChains(): ChainId[] {
    return this.supported;
  }

  protected calculateUrl(chainId: ChainId): string {
    return buildOneRPCUrl({ chainId, apiKey: this.key });
  }
}

export function buildOneRPCUrl({ chainId, apiKey }: { chainId: ChainId; apiKey?: string }) {
  let url = 'https://1rpc.io/';
  if (apiKey) {
    url += `${apiKey}/`;
  }
  url += SUPPORTED_CHAINS[chainId];
  return url;
}

export function oneRPCSupportedChains(): ChainId[] {
  return Object.keys(SUPPORTED_CHAINS).map(Number);
}
