import { http } from 'viem';
import { ChainId } from '@types';
import { IProviderSource } from '@services/providers/types';

export abstract class BaseHttpProvider implements IProviderSource {
  getViemTransport({ chainId }: { chainId: ChainId }) {
    this.assertChainIsValid(chainId);
    const url = this.calculateUrl(chainId);
    return http(url);
  }

  abstract supportedChains(): ChainId[];
  protected abstract calculateUrl(chainId: ChainId): string;

  private assertChainIsValid(chainId: ChainId) {
    if (!this.supportedChains().includes(chainId)) throw new Error(`Chain with id ${chainId} is not supported`);
  }
}
