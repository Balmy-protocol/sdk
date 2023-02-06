import { ChainId } from '@types';
import { providers } from 'ethers';

export type IProviderSource = {
  supportedChains(): ChainId[];
  getProvider(_: { chainId: ChainId }): providers.BaseProvider;
};
