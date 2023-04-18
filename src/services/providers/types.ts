import { ChainId } from '@types';
import { providers } from 'ethers';
import { PublicClient, Transport } from 'viem';

export type IProviderService = {
  supportedChains(): ChainId[];
  getEthersProvider(_: { chainId: ChainId }): providers.BaseProvider;
  getViemPublicClient(_: { chainId: ChainId }): PublicClient;
};

export type IProviderSource = {
  supportedChains(): ChainId[];
  getEthersProvider(_: { chainId: ChainId }): providers.BaseProvider;
  getViemTransport(_: { chainId: ChainId }): Transport;
};
