import { ChainId, TimeString, TokenAddress } from '@types';
import { IFetchService } from '@services/fetch/types';
import { ITokenSource, KeyOfToken } from '../types';
import { DefiLlamaClient } from '@shared/defi-llama';

export type DefiLlamaToken = {
  decimals: number;
  price: number;
  symbol: string;
};
export class DefiLlamaTokenSource implements ITokenSource<DefiLlamaToken> {
  private readonly defiLlama: DefiLlamaClient;

  constructor(fetch: IFetchService) {
    this.defiLlama = new DefiLlamaClient(fetch);
  }

  async getTokens(params: {
    addresses: Record<ChainId, TokenAddress[]>;
    config?: { timeout?: TimeString };
  }): Promise<Record<ChainId, Record<TokenAddress, DefiLlamaToken>>> {
    const result: Record<ChainId, Record<TokenAddress, DefiLlamaToken>> = {};
    const data = await this.defiLlama.getData(params);
    for (const [chainIdString, tokens] of Object.entries(data)) {
      const chainId = Number(chainIdString);
      result[chainId] = {};
      for (const [address, { confidence, timestamp, ...token }] of Object.entries(tokens)) {
        result[chainId][address] = token;
      }
    }
    return result;
  }

  tokenProperties() {
    const properties: KeyOfToken<DefiLlamaToken>[] = ['symbol', 'decimals', 'price'];
    return Object.fromEntries(this.defiLlama.supportedChains().map((chainId) => [chainId, properties]));
  }
}
