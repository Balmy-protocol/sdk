import { BaseProvider, WebSocketProvider } from '@ethersproject/providers';
import { IProviderSource } from '@services/providers/types';
import { webSocket } from 'viem';
import { ChainId } from '@types';

export abstract class BaseWebSocketProvider implements IProviderSource {
  getEthersProvider({ chainId }: { chainId: ChainId }): BaseProvider {
    this.assertChainIsValid(chainId);
    const url = this.calculateUrl(chainId);
    return buildEthersProviderForWebSocketSource(url, chainId);
  }

  getViemTransport({ chainId }: { chainId: ChainId }) {
    this.assertChainIsValid(chainId);
    const url = this.calculateUrl(chainId);
    return buildViemTransportForWebSocketSource(url, chainId);
  }

  abstract supportedChains(): ChainId[];
  protected abstract calculateUrl(chainId: ChainId): string;

  private assertChainIsValid(chainId: ChainId) {
    if (!this.supportedChains().includes(chainId)) throw new Error(`Chain with id ${chainId} is not supported`);
  }
}

export function buildEthersProviderForWebSocketSource(url: string, chainId: ChainId) {
  return new WebSocketProvider(url, chainId);
}

export function buildViemTransportForWebSocketSource(url: string, chainId: ChainId) {
  return webSocket(url);
}
