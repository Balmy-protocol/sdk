import { ArrayTwoOrMore, UnionMerge } from '@utility-types';
import { ExpirationConfigOptions } from '@shared/generic-cache';
import { IFetchService } from '@services/fetch/types';
import { IMulticallService } from '@services/multicall/types';
import { ITokenSource, BaseTokenMetadata, ITokenService } from '@services/tokens/types';
import { CachedTokenSource } from '@services/tokens/token-sources/cached-token-source';
import { DefiLlamaToken, DefiLlamaTokenSource } from '@services/tokens/token-sources/defi-llama';
import { FallbackTokenSource } from '@services/tokens/token-sources/fallback-token-source';
import { RPCTokenSource } from '@services/tokens/token-sources/rpc-token-source';
import { TokenService } from '@services/tokens/token-service';

export type TokenSourceInput =
  | { type: 'defi-llama' }
  | { type: 'rpc-multicall' }
  | { type: 'cached'; underlyingSource: TokenSourceInput; expiration: ExpirationConfigOptions }
  | { type: 'custom'; instance: ITokenSource<object> }
  | { type: 'combine-when-possible'; sources: TokenSourceInput[] };

export type BuildTokenParams = { source: TokenSourceInput };
export type CalculateTokenFromSourceParams<T extends BuildTokenParams | undefined> = T extends BuildTokenParams
  ? CalculateTokenFromSource<T['source']>
  : CalculateTokenFromSource<undefined>;

type CalculateTokenFromSource<T extends TokenSourceInput | undefined> = T extends undefined
  ? UnionMerge<BaseTokenMetadata | DefiLlamaToken>
  : T extends { type: 'defi-llama' }
  ? DefiLlamaToken
  : T extends { type: 'rpc-multicall' }
  ? BaseTokenMetadata
  : T extends { type: 'custom'; instance: ITokenService<infer Token> }
  ? Token
  : T extends { type: 'combine-when-possible'; sources: ArrayTwoOrMore<TokenSourceInput> }
  ? ExtractTokenFromSources<T['sources']>
  : never;

type ExtractTokenFromSources<T extends ArrayTwoOrMore<TokenSourceInput>> = UnionMerge<
  { [K in keyof T]: T[K] extends TokenSourceInput ? CalculateTokenFromSource<T[K]> : T[K] }[number]
>;

export function buildTokenService<T extends BuildTokenParams | undefined>(
  params: T,
  fetchService: IFetchService,
  multicallService: IMulticallService
): ITokenService<CalculateTokenFromSourceParams<T>> {
  const source = buildSource(params?.source, { fetchService, multicallService });
  return new TokenService(source as unknown as ITokenSource<CalculateTokenFromSourceParams<T>>);
}

function buildSource<T extends TokenSourceInput>(
  source: T | undefined,
  { fetchService, multicallService }: { fetchService: IFetchService; multicallService: IMulticallService }
): ITokenSource<CalculateTokenFromSource<T>> {
  switch (source?.type) {
    case undefined:
      const defiLlama = new DefiLlamaTokenSource(fetchService);
      const rpc = new RPCTokenSource(multicallService);
      return new FallbackTokenSource([defiLlama, rpc]) as any;
    case 'defi-llama':
      return new DefiLlamaTokenSource(fetchService) as any;
    case 'cached':
      const underlying = buildSource(source.underlyingSource, { fetchService, multicallService });
      return new CachedTokenSource(underlying, source.expiration) as any;
    case 'rpc-multicall':
      return new RPCTokenSource(multicallService) as any;
    case 'custom':
      return source.instance as any;
    case 'combine-when-possible':
      return new FallbackTokenSource(source.sources.map((source) => buildSource(source, { fetchService, multicallService }))) as any;
  }
}
