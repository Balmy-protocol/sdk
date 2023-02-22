import { ChainId, TimeString, TokenAddress } from '@types';
import { UnionMerge } from '@utility-types';

export type ITokenService<TokenData> = {
  supportedChains(): ChainId[];
  tokenProperties(): Record<ChainId, PropertiesRecord<TokenData>>;
  getTokensForChain(_: {
    chainId: ChainId;
    addresses: TokenAddress[];
    config?: { timeout?: TimeString };
  }): Promise<Record<TokenAddress, TokenData>>;
  getTokens(_: {
    addresses: { chainId: ChainId; addresses: TokenAddress[] }[];
    config?: { timeout?: TimeString };
  }): Promise<Record<ChainId, Record<TokenAddress, TokenData>>>;
  getTokensByChainId(_: {
    addresses: Record<ChainId, TokenAddress[]>;
    config?: { timeout?: TimeString };
  }): Promise<Record<ChainId, Record<TokenAddress, TokenData>>>;
};

export type ITokenSource<TokenData> = {
  getTokens(_: {
    addresses: Record<ChainId, TokenAddress[]>;
    context?: { timeout?: TimeString };
  }): Promise<Record<ChainId, Record<TokenAddress, TokenData>>>;
  tokenProperties(): Record<ChainId, PropertiesRecord<TokenData>>;
};

export type PropertiesRecord<TokenData> = { [K in keyof TokenData]-?: undefined extends TokenData[K] ? 'optional' : 'present' };

export type BaseTokenMetadata = {
  decimals: number;
  symbol: string;
};

type TokenSourcesInList<T extends ITokenSource<object>[] | []> = { [K in keyof T]: T[K] extends ITokenSource<infer R> ? R : T[K] }[number];
export type MergeTokensFromSources<Sources extends ITokenSource<object>[] | []> = UnionMerge<TokenSourcesInList<Sources>>;
