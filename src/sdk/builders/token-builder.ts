import { ArrayTwoOrMore, UnionMerge } from '@utility-types';
import { ExpirationConfigOptions } from '@shared/generic-cache';
import { IFetchService } from '@services/fetch/types';
import { IMulticallService } from '@services/multicall/types';
import { ITokenSource, BaseToken, ITokenService } from '@services/tokens/types';
import { CachedTokenSource } from '@services/tokens/token-sources/cached-token-source';
import { DefiLlamaToken, DefiLlamaTokenSource } from '@services/tokens/token-sources/defi-llama';
import { FallbackTokenSource } from '@services/tokens/token-sources/fallback-token-source';
import { ProviderTokenSource } from '@services/tokens/token-sources/provider';
import { TokenService } from '@services/tokens/token-service';

type TokenSource =
  | { type: 'defi-llama' }
  | { type: 'rpc' }
  | { type: 'custom'; instance: ITokenSource<BaseToken> }
  | { type: 'combine-when-possible'; sources: ArrayTwoOrMore<TokenSource> };
type TokenSourceConfig = { useCaching: false } | { useCaching: true; expiration: ExpirationConfigOptions };
export type BuildTokenParams = { source: TokenSource; config?: TokenSourceConfig };
export type CalculateTokenFromSourceParams<T extends BuildTokenParams | undefined> = T extends BuildTokenParams
  ? CalculateTokenFromSource<T['source']>
  : CalculateTokenFromSource<undefined>;

type CalculateTokenFromSource<T extends TokenSource | undefined> = T extends undefined
  ? DefiLlamaToken
  : T extends { type: 'defi-llama' }
  ? DefiLlamaToken
  : T extends { type: 'rpc' }
  ? BaseToken
  : T extends { type: 'custom'; instance: ITokenService<infer Token> }
  ? Token
  : T extends { type: 'combine-when-possible'; sources: ArrayTwoOrMore<TokenSource> }
  ? ExtractTokenFromSources<T['sources']>
  : never;

type ExtractTokenFromSources<T extends ArrayTwoOrMore<TokenSource>> = UnionMerge<
  { [K in keyof T]: T[K] extends TokenSource ? CalculateTokenFromSource<T[K]> : T[K] }[number]
> &
  BaseToken;

export function buildTokenService<T extends BuildTokenParams | undefined>(
  params: T,
  fetchService: IFetchService,
  multicallService: IMulticallService
): ITokenService<CalculateTokenFromSourceParams<T>> {
  const defiLlama = new DefiLlamaTokenSource(fetchService);
  const provider = new ProviderTokenSource(multicallService);

  let source = buildSource(params?.source, { defiLlama, provider });
  if (params?.config?.useCaching) {
    source = new CachedTokenSource(source, params.config.expiration);
  }
  return new TokenService(source as unknown as ITokenSource<CalculateTokenFromSourceParams<T>>);
}

function buildSource<T extends TokenSource>(
  source: T | undefined,
  { defiLlama, provider }: { defiLlama: DefiLlamaTokenSource; provider: ProviderTokenSource }
): ITokenSource<CalculateTokenFromSource<T>> {
  switch (source?.type) {
    case undefined:
    case 'defi-llama':
      return defiLlama as any;
    case 'rpc':
      return provider as any;
    case 'custom':
      return source.instance as any;
    case 'combine-when-possible':
      return new FallbackTokenSource(source.sources.map((source) => buildSource(source, { defiLlama, provider }))) as any;
  }
}
