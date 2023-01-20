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

type TokenSource = 'defi-llama' | 'rpc' | { custom: ITokenSource<any> };
type TokenSourceCalculation = 'only-first-possible-source-on-list' | 'combine-when-possible';
type TokenSources = { source: TokenSource } | { sources: ArrayTwoOrMore<TokenSource>; calculation?: TokenSourceCalculation };
type TokenSourceConfig = { useCaching: false } | { useCaching: true; expiration: ExpirationConfigOptions };
export type BuildTokenParams = TokenSources & { config?: TokenSourceConfig };
export type CalculateTokenFromSources<T extends TokenSources | undefined> = T extends undefined
  ? DefiLlamaToken
  : T extends { source: TokenSource }
  ? CalculateTokenFromSource<T['source']>
  : T extends { sources: ArrayTwoOrMore<TokenSource> }
  ? ExtractTokenFromSources<T['sources']>
  : never;

type CalculateTokenFromSource<T extends TokenSource> = T extends { custom: ITokenSource<infer Token> }
  ? Token
  : T extends 'defi-llama'
  ? DefiLlamaToken
  : T extends 'rpc'
  ? BaseToken
  : never;

type ExtractTokenFromSources<T extends ArrayTwoOrMore<TokenSource>> = UnionMerge<
  { [K in keyof T]: T[K] extends TokenSource ? CalculateTokenFromSource<T[K]> : T[K] }[number]
> &
  BaseToken;

export function buildTokenService<T extends BuildTokenParams>(
  params: T | undefined,
  fetchService: IFetchService,
  multicallService: IMulticallService
): ITokenService<CalculateTokenFromSources<T>> {
  const defiLlama = new DefiLlamaTokenSource(fetchService);
  const providerTokenSource = new ProviderTokenSource(multicallService);

  if (!params) {
    return buildTokenServiceFromSource(params, defiLlama) as CalculateTokenFromSources<T>;
  } else if ('source' in params) {
    const source = getTokenSourceFromConfig(params.source, { defiLlama, providerTokenSource });
    return buildTokenServiceFromSource(params, source);
  } else {
    const sources = params.sources.map((source) => getTokenSourceFromConfig(source, { defiLlama, providerTokenSource })) as ArrayTwoOrMore<
      ITokenSource<any>
    >;
    let source: ITokenSource<any>;
    switch (params.calculation) {
      case 'only-first-possible-source-on-list':
      // TODO
      case 'combine-when-possible':
      default:
        source = new FallbackTokenSource(sources);
        break;
    }
    return buildTokenServiceFromSource(params, source);
  }
}

function getTokenSourceFromConfig(
  source: TokenSource,
  { defiLlama, providerTokenSource }: { defiLlama: ITokenSource<DefiLlamaToken>; providerTokenSource: ITokenSource }
) {
  if (source === 'defi-llama') {
    return defiLlama;
  } else if (source === 'rpc') {
    return providerTokenSource;
  } else {
    return source.custom;
  }
}

function buildTokenServiceFromSource<Token extends BaseToken>(params: BuildTokenParams | undefined, source: ITokenSource<Token>) {
  if (params?.config?.useCaching) {
    source = new CachedTokenSource(source, params.config.expiration);
  }
  return new TokenService(source);
}
