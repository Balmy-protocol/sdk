import { BasedOnRequirements, ChainId, DefaultRequirements, FieldsRequirements, SupportInChain, TimeString, TokenAddress } from '@types';
import { UnionMerge } from '@utility-types';

export type IMetadataService<TokenMetadata extends object> = {
  supportedChains(): ChainId[];
  supportedProperties(): Record<ChainId, SupportInChain<TokenMetadata>>;
  getMetadataInChain<Requirements extends FieldsRequirements<TokenMetadata> = DefaultRequirements<TokenMetadata>>(_: {
    chainId: ChainId;
    tokens: TokenAddress[];
    config?: { fields?: Requirements; timeout?: TimeString };
  }): Promise<Record<TokenAddress, MetadataResult<TokenMetadata, Requirements>>>;
  getMetadata<Requirements extends FieldsRequirements<TokenMetadata> = DefaultRequirements<TokenMetadata>>(_: {
    tokens: MetadataInput[];
    config?: { fields?: Requirements; timeout?: TimeString };
  }): Promise<Record<ChainId, Record<TokenAddress, MetadataResult<TokenMetadata, Requirements>>>>;
};

export type IMetadataSource<TokenMetadata extends object> = {
  getMetadata<Requirements extends FieldsRequirements<TokenMetadata> = DefaultRequirements<TokenMetadata>>(_: {
    tokens: MetadataInput[];
    config?: { fields?: Requirements; timeout?: TimeString };
  }): Promise<Record<ChainId, Record<TokenAddress, MetadataResult<TokenMetadata, Requirements>>>>;
  supportedProperties(): Record<ChainId, SupportInChain<TokenMetadata>>;
};

export type MetadataResult<
  TokenMetadata extends object,
  Requirements extends FieldsRequirements<TokenMetadata> = DefaultRequirements<TokenMetadata>
> = BasedOnRequirements<TokenMetadata, Requirements>;

export type BaseTokenMetadata = {
  symbol: string;
  decimals: number;
};

export type ExtractMetadata<Source extends IMetadataSource<object>> = Source extends IMetadataSource<infer R> ? R : never;

export type MergeMetadata<Sources extends IMetadataSource<object>[] | []> = UnionMerge<
  { [K in keyof Sources]: ExtractMetadata<Sources[K]> }[number]
>;

export type MetadataInput = {
  chainId: ChainId;
  token: TokenAddress;
};
