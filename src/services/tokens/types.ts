import { ChainId, TokenAddress } from '@types';
import { UnionMerge } from '@utility-types';

export type ITokenService<Token extends BaseToken> = {
  supportedChains(): ChainId[];
  getTokensForChain(chainId: ChainId, addresses: TokenAddress[]): Promise<Record<TokenAddress, Token>>;
  getTokens(...addresses: { chainId: ChainId; addresses: TokenAddress[] }[]): Promise<Record<ChainId, Record<TokenAddress, Token>>>;
  getTokensByChainId(addresses: Record<ChainId, TokenAddress[]>): Promise<Record<ChainId, Record<TokenAddress, Token>>>;
};

export type ITokenSource<Token extends BaseToken = BaseToken> = {
  supportedChains(): ChainId[];
  getTokens(addresses: Record<ChainId, TokenAddress[]>): Promise<Record<ChainId, Record<TokenAddress, Token>>>;
  addedProperties(): AddedProperties<Token>[];
};

export type AddedProperties<Token extends BaseToken = BaseToken> = Exclude<keyof Token, keyof BaseToken>;

export type BaseToken = {
  address: TokenAddress;
  decimals: number;
  symbol: string;
};

type TokenSourcesInList<T extends ITokenSource<any>[] | []> = { [K in keyof T]: T[K] extends ITokenSource<infer R> ? R : T[K] }[number];
export type MergeTokenTokensFromSources<Sources extends ITokenSource<any>[] | []> = UnionMerge<TokenSourcesInList<Sources>> & BaseToken;
