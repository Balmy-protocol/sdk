import { ChainId, TimeString, TokenAddress } from '@types';
import { UnionMerge } from '@utility-types';
import { DefiLlamaTokenSource } from './token-sources/defi-llama';
import { RPCTokenSource } from './token-sources/rpc-token-source';

export type ITokenService<TokenData extends object> = {
  supportedChains(): ChainId[];
  tokenProperties(): Record<ChainId, (keyof TokenData)[]>;
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

export type ITokenSource<TokenData extends object> = {
  getTokens(_: {
    addresses: Record<ChainId, TokenAddress[]>;
    context?: { timeout?: TimeString };
  }): Promise<Record<ChainId, Record<TokenAddress, TokenData>>>;
  tokenProperties(): Record<ChainId, (keyof TokenData & string)[]>;
};

export type KeyOfToken<TokenData extends object> = keyof TokenData & string;

export type BaseTokenMetadata = {
  decimals: number;
  symbol: string;
};

type TokenSourcesInList<T extends ITokenSource<object>[] | []> = { [K in keyof T]: T[K] extends ITokenSource<infer R> ? R : T[K] }[number];
export type MergeTokensFromSources<Sources extends ITokenSource<object>[] | []> = UnionMerge<TokenSourcesInList<Sources>>;
