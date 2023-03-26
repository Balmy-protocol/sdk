import { ChainId, FieldsRequirements, SupportInChain, TimeString, TokenAddress } from '@types';
import { IFetchService } from '@services/fetch/types';
import { BaseTokenMetadata, IMetadataSource, MetadataResult } from '../types';
import { PortalsFiClient } from '@shared/portals-fi';

type PortalsFiMetadata = BaseTokenMetadata & { name: string };
export class PortalsFiMetadataSource implements IMetadataSource<PortalsFiMetadata> {
  private readonly portalsFi: PortalsFiClient;

  constructor(fetch: IFetchService) {
    this.portalsFi = new PortalsFiClient(fetch);
  }

  async getMetadata<Requirements extends FieldsRequirements<PortalsFiMetadata>>(params: {
    addresses: Record<ChainId, TokenAddress[]>;
    config?: { timeout?: TimeString };
  }) {
    const result: Record<ChainId, Record<TokenAddress, PortalsFiMetadata>> = {};
    const data = await this.portalsFi.getData(params);
    for (const [chainIdString, tokens] of Object.entries(data)) {
      const chainId = Number(chainIdString);
      result[chainId] = {};
      for (const [address, { price, ...metadata }] of Object.entries(tokens)) {
        result[chainId][address] = metadata;
      }
    }
    return result as Record<ChainId, Record<TokenAddress, MetadataResult<PortalsFiMetadata, Requirements>>>;
  }

  supportedProperties() {
    const properties: SupportInChain<PortalsFiMetadata> = { symbol: 'present', decimals: 'present', name: 'present' };
    return Object.fromEntries(this.portalsFi.supportedChains().map((chainId) => [chainId, properties]));
  }
}
