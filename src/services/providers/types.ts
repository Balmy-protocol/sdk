import { ChainId } from '@types';
import { providers } from 'ethers';

export type IProviderSource = {
  supportedChains(): ChainId[];
  getEthersProvider(_: { chainId: ChainId }): providers.BaseProvider;
};
