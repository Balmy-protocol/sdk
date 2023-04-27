import { ChainId } from '@types';
import { providers } from 'ethers';
import { PublicClient, Transport } from 'viem';

export type ProviderClientSupport = { ethers: boolean; viem: boolean };

export type IProviderService = {
  supportedChains(): ChainId[];
  supportedClients(): Record<ChainId, ProviderClientSupport>;
  getEthersProvider(_: { chainId: ChainId }): providers.BaseProvider;
  getViemPublicClient(_: { chainId: ChainId }): PublicClient;
};

export type IProviderSource = {
  supportedClients(): Record<ChainId, ProviderClientSupport>;
  getEthersProvider(_: { chainId: ChainId }): providers.BaseProvider;
  getViemTransport(_: { chainId: ChainId }): Transport;
};
