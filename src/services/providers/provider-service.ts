import { ChainId } from '@types';
import { BaseProvider } from '@ethersproject/providers';
import { IProviderService, IProviderSource } from './types';

export class ProviderService implements IProviderService {
  constructor(private readonly source: IProviderSource) {}

  supportedChains(): ChainId[] {
    return this.source.supportedChains();
  }

  getEthersProvider({ chainId }: { chainId: ChainId }): BaseProvider {
    return this.source.getEthersProvider({ chainId });
  }
}
