import { ChainId } from '@types';
import { BaseHttpProvider, HttpProviderConfig } from './base/base-http-provider';

export class GetBlockProviderSource extends BaseHttpProvider {
  private readonly supported: ChainId[];
  private readonly accessTokens: Record<ChainId, string>;

  constructor({ accessTokens, config }: { accessTokens: Record<ChainId, string>; config?: HttpProviderConfig }) {
    super(config);
    this.accessTokens = accessTokens;
    this.supported = Object.keys(accessTokens).map(Number);
  }

  supportedChains(): ChainId[] {
    return this.supported;
  }

  protected calculateUrl(chainId: ChainId): string {
    return buildGetBlockRPCUrl({ accessToken: this.accessTokens[chainId] });
  }
}

export function buildGetBlockRPCUrl({ accessToken }: { accessToken: string }) {
  return `https://go.getblock.io/${accessToken}/`;
}
