import { ChainId, SupportInChain, TimeString, TokenAddress } from '@types';
import { IFetchService } from '@services/fetch/types';
import { BaseTokenMetadata, IMetadataSource } from '../types';
import { DefiLlamaClient } from '@shared/defi-llama';

export class DefiLlamaMetadataSource implements IMetadataSource<BaseTokenMetadata> {
  private readonly defiLlama: DefiLlamaClient;

  constructor(fetch: IFetchService) {
    this.defiLlama = new DefiLlamaClient(fetch);
  }

  async getMetadata(params: {
    addresses: Record<ChainId, TokenAddress[]>;
    config?: { timeout?: TimeString };
  }): Promise<Record<ChainId, Record<TokenAddress, BaseTokenMetadata>>> {
    const result: Record<ChainId, Record<TokenAddress, BaseTokenMetadata>> = {};
    const data = await this.defiLlama.getData(params);
    for (const [chainIdString, tokens] of Object.entries(data)) {
      const chainId = Number(chainIdString);
      result[chainId] = {};
      for (const [address, { confidence, timestamp, price, ...metadata }] of Object.entries(tokens)) {
        result[chainId][address] = metadata;
      }
    }
    return result;
  }

  supportedProperties() {
    const properties: SupportInChain<BaseTokenMetadata> = { symbol: 'present', decimals: 'present' };
    return Object.fromEntries(this.defiLlama.supportedChains().map((chainId) => [chainId, properties]));
  }
}
