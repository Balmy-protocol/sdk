import { providers } from 'ethers';
import crossFetch from 'cross-fetch';
import { Chains } from '@chains';
import { ChainId, TimeString } from '@types';
import { ArrayTwoOrMore, UnionMerge } from '@utility-types';
import { ExpirationConfigOptions } from '@shared/generic-cache';
import { Fetch, IFetchService } from '@services/fetch/types';
import { FetchService } from '@services/fetch/fetch-service';
import { IProviderSource } from '@services/providers/types';
import { PrioritizedProviderSourceCombinator } from '@services/providers/provider-sources/prioritized-provider-source-combinator';
import { PublicProvidersSource } from '@services/providers/provider-sources/public-providers';
import { FallbackSource } from '@services/providers/provider-sources/fallback-provider ';
import { SingleProviderSource } from '@services/providers/provider-sources/single-provider';
import { IMulticallService } from '@services/multicall/types';
import { MulticallService } from '@services/multicall/multicall-service';
import { IGasPriceSource, IGasService, IQuickGasCostCalculatorBuilder } from '@services/gas/types';
import { GasCalculatorBuilderCombiner } from '@services/gas/gas-calculator-builders/gas-calculator-builder-combiner';
import { GenericGasCalculatorBuilder } from '@services/gas/gas-calculator-builders/generic-gas-calculator-builder';
import { OptimismGasCalculatorBuilder } from '@services/gas/gas-calculator-builders/optimism';
import { PrioritizedGasPriceSourceCombinator } from '@services/gas/gas-price-sources/prioritized-gas-price-source-combinator';
import { OpenOceanGasPriceSource } from '@services/gas/gas-price-sources/open-ocean';
import { CachedGasCalculatorBuilder } from '@services/gas/gas-calculator-builders/cached-gas-calculator-builder';
import { ProviderGasPriceSource } from '@services/gas/gas-price-sources/provider';
import { GasService } from '@services/gas/gas-service';
import { BaseToken, ITokenService, ITokenSource } from '@services/tokens/types';
import { DefiLlamaToken, DefiLlamaTokenSource } from '@services/tokens/token-sources/defi-llama';
import { ProviderTokenSource } from '@services/tokens/token-sources/provider';
import { CachedTokenSource } from '@services/tokens/token-sources/cached-token-source';
import { FallbackTokenSource } from '@services/tokens/token-sources/fallback-token-source';
import { TokenService } from '@services/tokens/token-service';
import { GlobalQuoteSourceConfig } from '@services/quotes/types';
import { AllSourcesConfig, SourcesBasedOnConfig } from '@services/quotes/sources-list';
import { QuoteService } from '@services/quotes/quote-service';
import { ISDK } from './types';

export function buildSDK<Params extends BuildParams<CustomConfig>, CustomConfig extends Partial<AllSourcesConfig> = {}>(
  params?: Params
): ISDK<SourcesBasedOnConfig<CustomConfig>, CalculateTokenFromSources<Params['tokens']>> {
  const fetchService = buildFetchService(params?.fetch);
  const providerSource = buildProviderSource(params?.provider);
  const multicallService = new MulticallService(providerSource);
  const gasService = buildGasService(params?.gas, fetchService, providerSource, multicallService);
  const tokenService = buildTokenService(params?.tokens, fetchService, multicallService);
  const quoteService = buildQuoteService(params?.quotes, fetchService, gasService, tokenService);

  return {
    fetchService,
    multicallService,
    gasService,
    tokenService,
    quoteService,
  };
}

// FETCH
type BuildFetchParams = { fetch?: Fetch };

function buildFetchService(params?: BuildFetchParams) {
  return new FetchService(params?.fetch ?? crossFetch);
}

// PROVIDER
type ProviderSource = providers.BaseProvider | 'public-rpcs' | { custom: IProviderSource };
type ProviderCalculation = 'only-first-possible-provider-on-list' | 'combine-when-possible';
type BuildProviderParams = { source: ProviderSource } | { sources: ArrayTwoOrMore<ProviderSource>; calculation?: ProviderCalculation };

function buildProviderSource(params?: BuildProviderParams) {
  let source: IProviderSource;
  if (!params) {
    source = new PublicProvidersSource();
  } else if ('source' in params) {
    source = getProviderSourceForConfig(params.source);
  } else {
    const sources = params.sources.map(getProviderSourceForConfig) as ArrayTwoOrMore<IProviderSource>;
    switch (params.calculation) {
      case 'only-first-possible-provider-on-list':
        source = new PrioritizedProviderSourceCombinator(sources);
        break;
      case 'combine-when-possible':
      default:
        source = new FallbackSource(sources);
        break;
    }
  }
  return source;
}

function getProviderSourceForConfig(source: ProviderSource) {
  if (source === 'public-rpcs') {
    return new PublicProvidersSource();
  } else if ('custom' in source) {
    return source.custom;
  } else {
    return new SingleProviderSource(source);
  }
}

// GAS
type GasSource = 'open-ocean' | 'rpc' | { custom: IGasPriceSource<any> };
type GasSourceCalculation = 'only-first-possible-source-on-list';
type GasSources = { source: GasSource } | { sources: ArrayTwoOrMore<GasSource>; calculation?: GasSourceCalculation; timeout?: TimeString };
type GasSourceConfig =
  | { useCaching: false }
  | { useCaching: true; expiration: ExpirationConfigOptions; overrides?: Record<ChainId, ExpirationConfigOptions> };
type BuildGasParams = GasSources & { config?: GasSourceConfig };

function buildGasService(
  params: BuildGasParams | undefined,
  fetchService: IFetchService,
  providerSource: IProviderSource,
  multicallService: IMulticallService
) {
  const openOceanSource = new OpenOceanGasPriceSource(fetchService);
  const providerGasSource = new ProviderGasPriceSource(providerSource);

  let source: IGasPriceSource<any>;
  if (!params) {
    source = new PrioritizedGasPriceSourceCombinator([openOceanSource, providerGasSource]);
  } else if ('source' in params) {
    source = getGasSourceForConfig(params.source, { openOceanSource, providerGasSource });
  } else {
    const sources = params.sources.map((source) => getGasSourceForConfig(source, { openOceanSource, providerGasSource })) as ArrayTwoOrMore<
      IGasPriceSource<any>
    >;
    switch (params.calculation) {
      case 'only-first-possible-source-on-list':
      default:
        source = new PrioritizedGasPriceSourceCombinator(sources);
        break;
    }
  }

  let gasCostCalculatorBuilder: IQuickGasCostCalculatorBuilder = buildGasCalculatorBuilder({ gasPriceSource: source, multicallService });
  if (params?.config?.useCaching) {
    // Add caching if necessary
    gasCostCalculatorBuilder = new CachedGasCalculatorBuilder({
      wrapped: gasCostCalculatorBuilder,
      expiration: { default: params.config.expiration, overrides: params.config.overrides },
    });
  }

  return new GasService({ providerSource, gasCostCalculatorBuilder });
}

function getGasSourceForConfig(
  source: GasSource,
  { openOceanSource, providerGasSource }: { openOceanSource: OpenOceanGasPriceSource; providerGasSource: ProviderGasPriceSource }
) {
  if (source === 'open-ocean') {
    return openOceanSource;
  } else if (source === 'rpc') {
    return providerGasSource;
  } else {
    return source.custom;
  }
}

function buildGasCalculatorBuilder({
  gasPriceSource,
  multicallService,
}: {
  gasPriceSource: IGasPriceSource<any>;
  multicallService: IMulticallService;
}) {
  const defaultCalculatorBuilder = new GenericGasCalculatorBuilder(gasPriceSource);
  const calculatorBuilderOverrides = {
    [Chains.OPTIMISM.chainId]: new OptimismGasCalculatorBuilder(multicallService),
  };
  return new GasCalculatorBuilderCombiner({ defaultCalculatorBuilder, calculatorBuilderOverrides });
}

// TOKEN
type TokenSource = 'defi-llama' | 'rpc' | { custom: ITokenSource<any> };
type TokenSourceCalculation = 'only-first-possible-source-on-list' | 'combine-when-possible';
type TokenSources =
  | { source: TokenSource }
  | { sources: ArrayTwoOrMore<TokenSource>; calculation?: TokenSourceCalculation; timeout?: TimeString };
type TokenSourceConfig = { useCaching: false } | { useCaching: true; expiration: ExpirationConfigOptions };
type BuildTokenParams = TokenSources & { config?: TokenSourceConfig };

type CalculateTokenFromSource<T extends TokenSource> = T extends { custom: ITokenSource<infer Token> }
  ? Token
  : T extends 'defi-llama'
  ? DefiLlamaToken
  : T extends 'rpc'
  ? BaseToken
  : never;

type CalculateTokenFromSources<T extends TokenSources | undefined> = T extends undefined
  ? DefiLlamaToken
  : T extends { source: TokenSource }
  ? CalculateTokenFromSource<T['source']>
  : T extends { sources: ArrayTwoOrMore<TokenSource> }
  ? ExtractTokenFromSources<T['sources']>
  : never;

type ExtractTokenFromSources<T extends ArrayTwoOrMore<TokenSource>> = UnionMerge<
  { [K in keyof T]: T[K] extends TokenSource ? CalculateTokenFromSource<T[K]> : T[K] }[number]
> &
  BaseToken;

function buildTokenService<T extends BuildTokenParams>(
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

// QUOTE
type BuildQuoteParams<CustomConfig extends Partial<AllSourcesConfig>> = { config?: GlobalQuoteSourceConfig & CustomConfig };

function buildQuoteService<CustomConfig extends Partial<AllSourcesConfig>>(
  params: BuildQuoteParams<CustomConfig> | undefined,
  fetchService: IFetchService,
  gasService: IGasService,
  tokenService: ITokenService<BaseToken>
) {
  return new QuoteService<CustomConfig>({
    fetchService,
    gasService,
    tokenService,
    config: params?.config,
  });
}

type BuildParams<CustomConfig extends Partial<AllSourcesConfig>> = {
  fetch?: BuildFetchParams;
  provider?: BuildProviderParams;
  gas?: BuildGasParams;
  tokens?: BuildTokenParams;
  quotes?: BuildQuoteParams<CustomConfig>;
};
