import { BaseProvider, StaticJsonRpcProvider } from '@ethersproject/providers';
import { http } from 'viem';
import { ChainId } from '@types';
import { IProviderSource } from '@services/providers/types';

export abstract class BaseHttpProvider implements IProviderSource {
  getEthersProvider({ chainId }: { chainId: ChainId }): BaseProvider {
    this.assertChainIsValid(chainId);
    const url = this.calculateUrl(chainId);
    return buildEthersProviderForHttpSource(url, chainId);
  }

  getViemTransport({ chainId }: { chainId: ChainId }) {
    this.assertChainIsValid(chainId);
    const url = this.calculateUrl(chainId);
    return buildViemTransportForHttpSource(url, chainId);
  }

  abstract supportedChains(): ChainId[];
  protected abstract calculateUrl(chainId: ChainId): string;

  private assertChainIsValid(chainId: ChainId) {
    if (!this.supportedChains().includes(chainId)) throw new Error(`Chain with id ${chainId} is not supported`);
  }
}

export function buildEthersProviderForHttpSource(url: string, chainId: ChainId) {
  return new StaticJsonRpcProvider(url, chainId);
}

export function buildViemTransportForHttpSource(url: string, chainId: ChainId) {
  return http(url);
}
