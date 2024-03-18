import { Chains } from '@chains';
import { ChainId } from '@types';

export const PERMIT2_ADDRESS = '0x000000000022d473030f116ddee9f6b43ac78ba3';
export function PERMIT2_ADAPTER_ADDRESS(chainId: ChainId) {
  switch (chainId) {
    case Chains.POLYGON_ZKEVM.chainId:
      return '0xA70C8401C058B6198e1cb085091DE13498CEc0dC';
    default:
      return '0xED306e38BB930ec9646FF3D917B2e513a97530b1';
  }
}

export const WORDS_FOR_NONCE_CALCULATION = 10;
export const PERMIT2_SUPPORTED_CHAINS = [
  Chains.ETHEREUM,
  Chains.POLYGON,
  Chains.BNB_CHAIN,
  Chains.AVALANCHE,
  Chains.FANTOM,
  Chains.ARBITRUM,
  Chains.OPTIMISM,
  Chains.BASE,
  Chains.MOONRIVER,
  Chains.MOONBEAM,
  Chains.FUSE,
  Chains.EVMOS,
  Chains.CELO,
  Chains.GNOSIS,
  Chains.KAVA,
  Chains.POLYGON_ZKEVM,
  Chains.OKC,
  Chains.LINEA,
  Chains.ROOTSTOCK,
  Chains.BLAST,
].map(({ chainId }) => chainId);
