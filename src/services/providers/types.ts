import { ChainId } from '@types';
import { PublicClient, Transport } from 'viem';

export type IProviderService = {
  supportedChains(): ChainId[];
  getViemPublicClient(_: { chainId: ChainId }): PublicClient;
  getViemTransport(_: { chainId: ChainId }): Transport;
};

export type IProviderSource = {
  supportedChains(): ChainId[];
  getViemTransport(_: { chainId: ChainId }): Transport;
};
