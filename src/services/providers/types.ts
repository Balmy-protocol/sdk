import { ChainId } from '@types';
import { providers } from 'ethers';

export type IProviderService = {
  supportedChains(): ChainId[];
  getEthersProvider(_: { chainId: ChainId }): providers.BaseProvider;
};

export type IProviderSource = {
  supportedChains(): ChainId[];
  getEthersProvider(_: { chainId: ChainId }): providers.BaseProvider;
};
