import {
  arbitrum,
  harmonyOne,
  mainnet,
  optimism,
  polygon,
  sepolia,
  cronos,
  zora,
  bsc,
  avalanche,
  celo,
  fantom,
  gnosis,
  moonbeam,
  moonriver,
  okc,
  polygonZkEvm,
} from 'viem/chains';

export const chainIdToViemChain = (chainId: number) => {
  const supported = [
    arbitrum,
    harmonyOne,
    mainnet,
    optimism,
    polygon,
    sepolia,
    cronos,
    zora,
    bsc,
    avalanche,
    celo,
    fantom,
    gnosis,
    moonbeam,
    moonriver,
    okc,
    polygonZkEvm,
  ];

  return supported.find((network) => network.id == chainId);
};
