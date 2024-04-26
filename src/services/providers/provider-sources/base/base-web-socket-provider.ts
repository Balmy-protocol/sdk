import { IProviderSource } from '@services/providers/types';
import { webSocket } from 'viem';
import { ChainId } from '@types';

export abstract class BaseWebSocketProvider implements IProviderSource {
  getViemTransport({ chainId }: { chainId: ChainId }) {
    this.assertChainIsValid(chainId);
    const url = this.calculateUrl(chainId);
    return webSocket(url);
  }

  abstract supportedChains(): ChainId[];
  protected abstract calculateUrl(chainId: ChainId): string;

  private assertChainIsValid(chainId: ChainId) {
    if (!this.supportedChains().includes(chainId)) throw new Error(`Chain with id ${chainId} is not supported`);
  }
}
