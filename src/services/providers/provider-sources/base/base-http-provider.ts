import { BaseProvider, JsonRpcProvider } from '@ethersproject/providers';
import { IProviderSource } from '@services/providers/types';
import { ChainId } from '@types';

export abstract class BaseHttpProvider implements IProviderSource {
  getEthersProvider({ chainId }: { chainId: ChainId }): BaseProvider {
    this.assertChainIsValid(chainId);
    const url = this.calculateUrl(chainId);
    return buildEthersProviderForHttpSource(url, chainId);
  }

  abstract supportedChains(): ChainId[];
  protected abstract calculateUrl(chainId: ChainId): string;

  private assertChainIsValid(chainId: ChainId) {
    if (!this.supportedChains().includes(chainId)) throw new Error(`Chain with id ${chainId} is not supported`);
  }
}

export function buildEthersProviderForHttpSource(url: string, chainId: ChainId) {
  return new JsonRpcProvider(url, chainId);
}
