import { ChainId, DefaultRequirements, FieldsRequirements, SupportInChain, SupportRecord, TimeString, TokenAddress } from '@types';
import { IFetchService } from '@services/fetch';
import { CHANGELLY_METADATA } from '@services/quotes/quote-sources/changelly-quote-source';
import { BaseTokenMetadata, IMetadataSource, MetadataResult } from '../types';

type ChangellyMetadata = BaseTokenMetadata & { name: string };
export class ChangellyMetadataSource implements IMetadataSource<ChangellyMetadata> {
  constructor(private readonly fetchService: IFetchService, private readonly apiKey: string) {}

  supportedProperties(): Record<ChainId, SupportInChain<ChangellyMetadata>> {
    const support: SupportRecord<ChangellyMetadata> = { symbol: 'present', decimals: 'present', name: 'present' };
    return Object.fromEntries(CHANGELLY_METADATA.supports.chains.map((chainId) => [Number(chainId), support]));
  }

  async getMetadata<Requirements extends FieldsRequirements<ChangellyMetadata> = DefaultRequirements<ChangellyMetadata>>({
    addresses,
    config,
  }: {
    addresses: Record<ChainId, TokenAddress[]>;
    config?: { fields?: Requirements; timeout?: TimeString };
  }): Promise<Record<ChainId, Record<TokenAddress, MetadataResult<ChangellyMetadata, Requirements>>>> {
    const allChains = Object.keys(addresses).map(Number);
    const allAddresses = [
      ...new Set(
        Object.values(addresses)
          .flat()
          .map((address) => address.toLowerCase())
      ),
    ];
    const body = { filter: { addresses: allAddresses, chain_ids: allChains }, paging: { page: 1, page_size: 0 } };
    const response = await this.fetchService.fetch(`https://dex-api.changelly.com/v2/tokens/list`, {
      method: 'POST',
      body: JSON.stringify(body),
      headers: { 'X-Api-Key': this.apiKey },
      timeout: config?.timeout,
    });
    const { tokens }: Result = await response.json();
    const resultByKey: Record<string, ChangellyMetadata> = Object.fromEntries(
      tokens.map(({ chainId, address, ...metadata }) => [`${chainId}-${address.toLowerCase()}`, metadata])
    );
    const result: Record<ChainId, Record<TokenAddress, ChangellyMetadata>> = {};
    for (const [chainId, tokenAddresses] of Object.entries(addresses)) {
      result[Number(chainId)] = Object.fromEntries(
        tokenAddresses.map((address) => [address, resultByKey[`${chainId}-${address.toLowerCase()}`]])
      );
    }
    return result as Record<ChainId, Record<TokenAddress, MetadataResult<ChangellyMetadata, Requirements>>>;
  }
}

type Result = {
  tokens: { chainId: ChainId; address: TokenAddress; name: string; symbol: string; decimals: number }[];
};
