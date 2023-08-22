import { Chains } from '@chains';

export const PERMIT2_ADDRESS = '0x000000000022d473030f116ddee9f6b43ac78ba3';
export const PERMIT2_ADAPTER_ADDRESS = '0xA70C8401C058B6198e1cb085091DE13498CEc0dC';
export const WORDS_FOR_NONCE_CALCULATION = 10;
export const PERMIT2_SUPPORTED_CHAINS = [
  Chains.ETHEREUM,
  Chains.POLYGON,
  Chains.BNB_CHAIN,
  Chains.AVALANCHE,
  Chains.FANTOM,
  Chains.ARBITRUM,
  Chains.OPTIMISM,
  Chains.BASE_GOERLI,
  Chains.MOONRIVER,
  Chains.MOONBEAM,
  Chains.FUSE,
  Chains.EVMOS,
  Chains.CELO,
  Chains.GNOSIS,
  Chains.KAVA,
  Chains.POLYGON_ZKEVM,
  Chains.HECO,
  Chains.OKC,
].map(({ chainId }) => chainId);
