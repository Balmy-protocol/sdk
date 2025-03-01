import { Chain, ChainId } from '@types';
import { Chains } from '@chains';
import { BaseHttpProvider, HttpProviderConfig } from './base/base-http-provider';

const SUPPORTED_NETWORKS: Chain[] = [
  Chains.ETHEREUM,
  Chains.OPTIMISM,
  Chains.BNB_CHAIN,
  Chains.GNOSIS,
  Chains.POLYGON,
  Chains.MANTLE,
  Chains.BASE,
  Chains.MODE,
  Chains.ARBITRUM,
  Chains.ARBITRUM_NOVA,
  Chains.AVALANCHE,
  Chains.LINEA,
  Chains.SCROLL,
  Chains.FUSE,
  Chains.opBNB,
  Chains.FANTOM,
  Chains.BOBA,
  Chains.METIS_ANDROMEDA,
  Chains.POLYGON_ZKEVM,
  Chains.MOONBEAM,
  Chains.CELO,
  Chains.BLAST,
  Chains.CRONOS,
  Chains.ROOTSTOCK,
  Chains.ONTOLOGY,
  Chains.OKC,
  Chains.VELAS,
  Chains.BIT_TORRENT,
  Chains.ASTAR,
];

export class ThirdWebProviderSource extends BaseHttpProvider {
  private readonly supported: ChainId[];

  constructor({ onChains, config }: { onChains?: ChainId[]; config?: HttpProviderConfig }) {
    super(config);
    this.supported = onChains ?? thirdWebSupportedChains();
  }

  supportedChains(): ChainId[] {
    return this.supported;
  }

  protected calculateUrl(chainId: ChainId): string {
    return buildThirdWebRPCUrl({ chainId });
  }
}

export function thirdWebSupportedChains(): ChainId[] {
  return SUPPORTED_NETWORKS.map(({ chainId }) => chainId);
}

export function buildThirdWebRPCUrl({ chainId }: { chainId: ChainId }) {
  return `https://${chainId}.rpc.thirdweb.com`;
}
