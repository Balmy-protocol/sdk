import { ChainId } from '@types';
import { BaseHttpProvider, HttpProviderConfig } from './base/base-http-provider';

export class HttpProviderSource extends BaseHttpProvider {
  private readonly url: string;
  private readonly chains: ChainId[];

  constructor({ url, chains, config }: { url: string; chains: ChainId[]; config?: HttpProviderConfig }) {
    super(config);
    if (chains.length === 0) throw new Error('Must support at least one chain');
    this.url = url;
    this.chains = chains;
  }

  supportedChains(): ChainId[] {
    return this.chains;
  }

  protected calculateUrl(chainId: number): string {
    return this.url;
  }
}
