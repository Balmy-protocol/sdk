import { http, HttpTransportConfig } from 'viem';
import { ChainId } from '@types';
import { IProviderSource } from '@services/providers/types';

export type HttpProviderConfig = Pick<HttpTransportConfig, 'batch'>;
export abstract class BaseHttpProvider implements IProviderSource {
  constructor(private readonly config: HttpProviderConfig | undefined) {}

  getViemTransport({ chainId }: { chainId: ChainId }) {
    this.assertChainIsValid(chainId);
    const url = this.calculateUrl(chainId);
    return http(url, this.config);
  }

  abstract supportedChains(): ChainId[];
  protected abstract calculateUrl(chainId: ChainId): string;

  private assertChainIsValid(chainId: ChainId) {
    if (!this.supportedChains().includes(chainId)) throw new Error(`Chain with id ${chainId} is not supported`);
  }
}
