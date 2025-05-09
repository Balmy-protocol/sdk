import { Chains } from '@chains';
import { ChainId } from '@types';
import { BaseHttpProvider, HttpProviderConfig } from './base/base-http-provider';

const SUPPORTED_CHAINS: Record<ChainId, string> = {
  [Chains.ETHEREUM.chainId]: 'ethereum',
  [Chains.ETHEREUM_SEPOLIA.chainId]: 'sepolia',
  [Chains.BNB_CHAIN.chainId]: 'bsc',
  [Chains.POLYGON.chainId]: 'polygon',
  [Chains.POLYGON_MUMBAI.chainId]: 'polygon-mumbai',
  [Chains.ARBITRUM.chainId]: 'arbitrum',
  [Chains.OPTIMISM.chainId]: 'optimism',
  [Chains.LINEA.chainId]: 'linea',
  [Chains.BASE.chainId]: 'base',
  [Chains.FANTOM.chainId]: 'fantom',
  [Chains.AVALANCHE.chainId]: 'avalanche',
  [Chains.GNOSIS.chainId]: 'gnosis',
  [Chains.AURORA.chainId]: 'aurora',
  [Chains.POLYGON_ZKEVM.chainId]: 'polygon-zkevm',
  [Chains.KAIA.chainId]: 'klaytn',
  [Chains.BOBA.chainId]: 'boba-eth',
  [Chains.CELO.chainId]: 'celo',
  [Chains.CRONOS.chainId]: 'cronos',
  [Chains.FUSE.chainId]: 'fuse',
  [Chains.HECO.chainId]: 'heco',
  [Chains.KAVA.chainId]: 'kava',
  [Chains.METIS_ANDROMEDA.chainId]: 'metis',
  [Chains.MOONBEAM.chainId]: 'moonbeam',
  [Chains.MOONRIVER.chainId]: 'moonriver',
  [Chains.OKC.chainId]: 'oktc',
  [Chains.opBNB.chainId]: 'opbnb',
  [Chains.MODE.chainId]: 'mode',
  [Chains.SCROLL.chainId]: 'scroll',
  [Chains.BLAST.chainId]: 'blast',
};

export class dRPCProviderSource extends BaseHttpProvider {
  private readonly supported: ChainId[];
  private readonly key: string;
  constructor({ key, onChains, config }: { key: string; onChains?: ChainId[]; config?: HttpProviderConfig }) {
    super(config);
    this.key = key;
    this.supported = onChains ?? dRPCSupportedChains();
  }

  supportedChains(): ChainId[] {
    return this.supported;
  }

  protected calculateUrl(chainId: ChainId): string {
    return buildDRPCUrl({ chainId, apiKey: this.key });
  }
}

export function buildDRPCUrl({ chainId, apiKey }: { chainId: ChainId; apiKey: string }) {
  const chainKey = SUPPORTED_CHAINS[chainId];
  return `https://lb.drpc.org/ogrpc?network=${chainKey}&dkey=${apiKey}`;
}

export function dRPCSupportedChains(): ChainId[] {
  return Object.keys(SUPPORTED_CHAINS).map(Number);
}
