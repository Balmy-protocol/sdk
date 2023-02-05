import { ArrayTwoOrMore, UnionMerge } from '@utility-types';
import { ExpirationConfigOptions } from '@shared/generic-cache';
import { IFetchService } from '@services/fetch/types';
import { IMulticallService } from '@services/multicall/types';
import { ITokenSource, BaseToken, ITokenService } from '@services/tokens/types';
import { CachedTokenSource } from '@services/tokens/token-sources/cached-token-source';
import { DefiLlamaToken, DefiLlamaTokenSource } from '@services/tokens/token-sources/defi-llama';
import { FallbackTokenSource } from '@services/tokens/token-sources/fallback-token-source';
import { RPCTokenSource } from '@services/tokens/token-sources/rpc-token-source';
import { TokenService } from '@services/tokens/token-service';

export type TokenSourceInput =
  | { type: 'defi-llama' }
  | { type: 'rpc' }
  | { type: 'custom'; instance: ITokenSource<BaseToken> }
  | { type: 'combine-when-possible'; sources: TokenSourceInput[] };

type CachingConfig = { useCaching: false } | { useCaching: true; expiration: ExpirationConfigOptions };
export type TokenSourceConfigInput = { caching?: CachingConfig };
export type BuildTokenParams = { source: TokenSourceInput; config?: TokenSourceConfigInput };
export type CalculateTokenFromSourceParams<T extends BuildTokenParams | undefined> = T extends BuildTokenParams
  ? CalculateTokenFromSource<T['source']>
  : CalculateTokenFromSource<undefined>;

type CalculateTokenFromSource<T extends TokenSourceInput | undefined> = T extends undefined
  ? UnionMerge<DefiLlamaToken | BaseToken>
  : T extends { type: 'defi-llama' }
  ? DefiLlamaToken
  : T extends { type: 'rpc' }
  ? BaseToken
  : T extends { type: 'custom'; instance: ITokenService<infer Token> }
  ? Token
  : T extends { type: 'combine-when-possible'; sources: ArrayTwoOrMore<TokenSourceInput> }
  ? ExtractTokenFromSources<T['sources']>
  : never;

type ExtractTokenFromSources<T extends ArrayTwoOrMore<TokenSourceInput>> = UnionMerge<
  { [K in keyof T]: T[K] extends TokenSourceInput ? CalculateTokenFromSource<T[K]> : T[K] }[number]
> &
  BaseToken;

export function buildTokenService<T extends BuildTokenParams | undefined>(
  params: T,
  fetchService: IFetchService,
  multicallService: IMulticallService
): ITokenService<CalculateTokenFromSourceParams<T>> {
  const defiLlama = new DefiLlamaTokenSource(fetchService);
  const rpc = new RPCTokenSource(multicallService);

  let source = buildSource(params?.source, { defiLlama, rpc });
  if (params?.config?.caching?.useCaching) {
    source = new CachedTokenSource(source, params.config.caching.expiration);
  }
  return new TokenService(source as unknown as ITokenSource<CalculateTokenFromSourceParams<T>>);
}

function buildSource<T extends TokenSourceInput>(
  source: T | undefined,
  { defiLlama, rpc }: { defiLlama: DefiLlamaTokenSource; rpc: RPCTokenSource }
): ITokenSource<CalculateTokenFromSource<T>> {
  switch (source?.type) {
    case undefined:
      return new FallbackTokenSource([defiLlama, rpc]) as any;
    case 'defi-llama':
      return defiLlama as any;
    case 'rpc':
      return rpc as any;
    case 'custom':
      return source.instance as any;
    case 'combine-when-possible':
      return new FallbackTokenSource(source.sources.map((source) => buildSource(source, { defiLlama, rpc }))) as any;
  }
}
