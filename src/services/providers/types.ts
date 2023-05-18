import { ChainId } from '@types';
import { Provider } from '@ethersproject/abstract-provider';
import { PublicClient, Transport } from 'viem';

export type ProviderClientSupport = { ethers: boolean; viem: boolean };

export type IProviderService = {
  supportedChains(): ChainId[];
  supportedClients(): Record<ChainId, ProviderClientSupport>;
  getEthersProvider(_: { chainId: ChainId }): Provider;
  getViemPublicClient(_: { chainId: ChainId }): PublicClient;
};

export type IProviderSource = {
  supportedClients(): Record<ChainId, ProviderClientSupport>;
  getEthersProvider(_: { chainId: ChainId }): Provider;
  getViemTransport(_: { chainId: ChainId }): Transport;
};
