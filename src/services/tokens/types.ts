import { ChainId, TimeString, TokenAddress } from '@types';
import { UnionMerge } from '@utility-types';

export type ITokenService<Token extends BaseToken> = {
  supportedChains(): ChainId[];
  getTokensForChain(chainId: ChainId, addresses: TokenAddress[], config?: { timeout?: TimeString }): Promise<Record<TokenAddress, Token>>;
  getTokens(
    addresses: { chainId: ChainId; addresses: TokenAddress[] }[],
    config?: { timeout?: TimeString }
  ): Promise<Record<ChainId, Record<TokenAddress, Token>>>;
  getTokensByChainId(
    addresses: Record<ChainId, TokenAddress[]>,
    config?: { timeout?: TimeString }
  ): Promise<Record<ChainId, Record<TokenAddress, Token>>>;
};

export type ITokenSource<Token extends BaseToken = BaseToken> = {
  supportedChains(): ChainId[];
  getTokens(
    addresses: Record<ChainId, TokenAddress[]>,
    context?: { timeout: TimeString }
  ): Promise<Record<ChainId, Record<TokenAddress, Token>>>;
  tokenProperties(): PropertiesRecord<Token>;
};

export type PropertiesRecord<Token extends BaseToken> = { [K in keyof Token]-?: undefined extends Token[K] ? 'optional' : 'present' };

export type BaseToken = {
  address: TokenAddress;
  decimals: number;
  symbol: string;
};

type TokenSourcesInList<T extends ITokenSource<BaseToken>[] | []> = { [K in keyof T]: T[K] extends ITokenSource<infer R> ? R : T[K] }[number];
export type MergeTokenTokensFromSources<Sources extends ITokenSource<BaseToken>[] | []> = UnionMerge<TokenSourcesInList<Sources>> & BaseToken;
