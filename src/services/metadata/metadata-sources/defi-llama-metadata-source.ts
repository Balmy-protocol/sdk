import { ChainId, FieldsRequirements, SupportInChain, TimeString, TokenAddress } from '@types';
import { IFetchService } from '@services/fetch/types';
import { BaseTokenMetadata, IMetadataSource, MetadataResult } from '../types';
import { DefiLlamaClient } from '@shared/defi-llama';

export class DefiLlamaMetadataSource implements IMetadataSource<BaseTokenMetadata> {
  private readonly defiLlama: DefiLlamaClient;

  constructor(fetch: IFetchService) {
    this.defiLlama = new DefiLlamaClient(fetch);
  }

  async getMetadata<Requirements extends FieldsRequirements<BaseTokenMetadata>>(params: {
    addresses: Record<ChainId, TokenAddress[]>;
    config?: { timeout?: TimeString };
  }) {
    const result: Record<ChainId, Record<TokenAddress, BaseTokenMetadata>> = {};
    const data = await this.defiLlama.getCurrentTokenData(params);
    for (const [chainIdString, tokens] of Object.entries(data)) {
      const chainId = Number(chainIdString);
      result[chainId] = {};
      for (const [address, { confidence, timestamp, price, ...metadata }] of Object.entries(tokens)) {
        result[chainId][address] = metadata;
      }
    }
    return result as Record<ChainId, Record<TokenAddress, MetadataResult<BaseTokenMetadata, Requirements>>>;
  }

  supportedProperties() {
    const properties: SupportInChain<BaseTokenMetadata> = { symbol: 'present', decimals: 'present' };
    return Object.fromEntries(this.defiLlama.supportedChains().map((chainId) => [chainId, properties]));
  }
}
