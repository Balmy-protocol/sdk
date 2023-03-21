import { ChainId, SupportInChain, TimeString, TokenAddress } from '@types';
import { UnionMerge } from '@utility-types';

export type IMetadataService<TokenMetadata extends object> = {
  supportedChains(): ChainId[];
  supportedProperties(): Record<ChainId, SupportInChain<TokenMetadata>>;
  getMetadataForChain(_: {
    chainId: ChainId;
    addresses: TokenAddress[];
    config?: { timeout?: TimeString };
  }): Promise<Record<TokenAddress, TokenMetadata>>;
  getMetadata(_: {
    addresses: Record<ChainId, TokenAddress[]>;
    config?: { timeout?: TimeString };
  }): Promise<Record<ChainId, Record<TokenAddress, TokenMetadata>>>;
};

export type IMetadataSource<TokenMetadata extends object> = {
  getMetadata(_: {
    addresses: Record<ChainId, TokenAddress[]>;
    config?: { timeout?: TimeString };
  }): Promise<Record<ChainId, Record<TokenAddress, TokenMetadata>>>;
  supportedProperties(): Record<ChainId, SupportInChain<TokenMetadata>>;
};

export type BaseTokenMetadata = {
  symbol: string;
  decimals: number;
};

export type ExtractMetadata<Source extends IMetadataSource<object>> = Source extends IMetadataSource<infer R> ? R : never;

export type MergeMetadata<Sources extends IMetadataSource<object>[] | []> = UnionMerge<
  { [K in keyof Sources]: ExtractMetadata<Sources[K]> }[number]
>;
