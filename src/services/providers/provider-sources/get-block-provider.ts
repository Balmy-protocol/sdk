import { Chains } from '@chains';
import { ChainId } from '@types';
import { BaseHttpProvider } from './base/base-http-provider';

const PLACEHOLDER = '${apiKey}';

const SUPPORTED_CHAINS: Record<ChainId, string> = {
  [Chains.ETHEREUM.chainId]: `https://eth.getblock.io/${PLACEHOLDER}/mainnet/`,
  [Chains.ETHEREUM_SEPOLIA.chainId]: `https://eth.getblock.io${PLACEHOLDER}/sepolia/`,
  [Chains.ETHEREUM_GOERLI.chainId]: `https://eth.getblock.io${PLACEHOLDER}/goerli/`,
  [Chains.BNB_CHAIN.chainId]: `https://bsc.getblock.io${PLACEHOLDER}/mainnet/`,
  [Chains.POLYGON.chainId]: `https://matic.getblock.io${PLACEHOLDER}/mainnet/`,
  [Chains.POLYGON_MUMBAI.chainId]: `https://matic.getblock.io${PLACEHOLDER}/testnet/`,
  [Chains.AVALANCHE.chainId]: `https://avax.getblock.io${PLACEHOLDER}/mainnet/ext/bc/C/rpc`,
  [Chains.FANTOM.chainId]: `https://ftm.getblock.io${PLACEHOLDER}/mainnet/`,
  [Chains.OPTIMISM.chainId]: `https://op.getblock.io${PLACEHOLDER}/mainnet/`,
  [Chains.GNOSIS.chainId]: `https://gno.getblock.io${PLACEHOLDER}/mainnet/`,
  [Chains.HECO.chainId]: `https://heco.getblock.io${PLACEHOLDER}/mainnet/`,
  [Chains.ARBITRUM.chainId]: `https://arb.getblock.io${PLACEHOLDER}/mainnet/`,
  [Chains.FUSE.chainId]: `https://fuse.getblock.io${PLACEHOLDER}/mainnet/`,
  [Chains.HARMONY_SHARD_0.chainId]: `https://one.getblock.io${PLACEHOLDER}/mainnet/`,
  [Chains.CRONOS.chainId]: `https://cro.getblock.io${PLACEHOLDER}/mainnet/`,
  [Chains.MOONBEAM.chainId]: `https://glmr.getblock.io${PLACEHOLDER}/mainnet/`,
  [Chains.MOONRIVER.chainId]: `https://movr.getblock.io${PLACEHOLDER}/mainnet/`,
  [Chains.ONTOLOGY.chainId]: `https://ont.getblock.io${PLACEHOLDER}/mainnet/`,
  [Chains.BIT_TORRENT.chainId]: `https://bttc.getblock.io${PLACEHOLDER}/mainnet/`,
  [Chains.LINEA.chainId]: `https://linea.getblock.io${PLACEHOLDER}/mainnet/`,
  [Chains.BASE.chainId]: `https://base.getblock.io${PLACEHOLDER}/mainnet/`,
  [Chains.BASE_GOERLI.chainId]: `https://base.getblock.io${PLACEHOLDER}/goerli/`,
};

export class GetBlockProviderSource extends BaseHttpProvider {
  private readonly supported: ChainId[];

  constructor(private readonly key: string, onChains?: ChainId[]) {
    super();
    this.supported = onChains ?? Object.keys(SUPPORTED_CHAINS).map(Number);
  }

  supportedChains(): ChainId[] {
    return this.supported;
  }

  protected calculateUrl(chainId: number): string {
    return SUPPORTED_CHAINS[chainId].replace(PLACEHOLDER, this.key);
  }
}
