import { ChainId } from '@types';
import { BaseProvider } from '@ethersproject/providers';
import { PublicClient, Transport } from 'viem';

export type ProviderClientSupport = { ethers: boolean; viem: boolean };

export type IProviderService = {
  supportedChains(): ChainId[];
  supportedClients(): Record<ChainId, ProviderClientSupport>;
  getEthersProvider(_: { chainId: ChainId }): BaseProvider;
  getViemPublicClient(_: { chainId: ChainId }): PublicClient;
};

export type IProviderSource = {
  supportedClients(): Record<ChainId, ProviderClientSupport>;
  getEthersProvider(_: { chainId: ChainId }): BaseProvider;
  getViemTransport(_: { chainId: ChainId }): Transport;
};
