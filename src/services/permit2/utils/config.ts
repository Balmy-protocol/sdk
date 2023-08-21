import { Chains } from '@chains';

export const PERMIT2_ADDRESS = '0x000000000022d473030f116ddee9f6b43ac78ba3';
export const PERMIT2_ADAPTER_ADDRESS = '0xD4C8fCc3a3b55C3ea300494a973558f5D9B8EF3D';
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
