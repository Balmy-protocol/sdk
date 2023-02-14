import { GlobalQuoteSourceConfig, SourceId, SourceMetadata } from './types';
import { Without } from '@utility-types';
import { QuoteSource, QuoteSourceMetadata, QuoteSourceSupport } from './quote-sources/base';
import { OdosQuoteSource, ODOS_METADATA } from './quote-sources/odos';
import { ParaswapQuoteSource, PARASWAP_METADATA } from './quote-sources/paraswap';
import { ZRXQuoteSource, ZRX_METADATA } from './quote-sources/0x';
import { OneInchQuoteSource, ONE_INCH_METADATA } from './quote-sources/1inch';
import { UniswapQuoteSource, UNISWAP_METADATA } from './quote-sources/uniswap';
import { OpenOceanQuoteSource, OPEN_OCEAN_METADATA } from './quote-sources/open-ocean';
import { LiFiQuoteSource, LI_FI_METADATA } from './quote-sources/li-fi';
import { KyberswapQuoteSource, KYBERSWAP_METADATA } from './quote-sources/kyberswap';
import { FirebirdQuoteSource, FIREBIRD_METADATA } from '@services/quotes/quote-sources/firebird';
import { RangoQuoteSource, RANGO_METADATA } from './quote-sources/rango';

const QUOTE_SOURCES = {
  paraswap: builder<ParaswapQuoteSource>(PARASWAP_METADATA, (config) => new ParaswapQuoteSource(config)),
  '0x': builder<ZRXQuoteSource>(ZRX_METADATA, (config) => new ZRXQuoteSource(config)),
  '1inch': builder<OneInchQuoteSource>(ONE_INCH_METADATA, (config) => new OneInchQuoteSource(config)),
  uniswap: builder<UniswapQuoteSource>(UNISWAP_METADATA, (config) => new UniswapQuoteSource(config)),
  'open-ocean': builder<OpenOceanQuoteSource>(OPEN_OCEAN_METADATA, (config) => new OpenOceanQuoteSource(config)),
  'li-fi': builder<LiFiQuoteSource>(LI_FI_METADATA, (config) => new LiFiQuoteSource(config)),
  kyberswap: builder<KyberswapQuoteSource>(KYBERSWAP_METADATA, (config) => new KyberswapQuoteSource(config)),
  odos: builderNeedsConfig<OdosQuoteSource>(ODOS_METADATA, (config) => new OdosQuoteSource(config)),
  firebird: builderNeedsConfig<FirebirdQuoteSource>(FIREBIRD_METADATA, (config) => new FirebirdQuoteSource(config)),
  rango: builderNeedsConfig<RangoQuoteSource>(RANGO_METADATA, (config) => new RangoQuoteSource(config)),
} satisfies Record<SourceId, QuoteSourceBuilder<any>>;

export const SOURCES_METADATA = Object.fromEntries(
  Object.entries(QUOTE_SOURCES).map(([sourceId, { metadata }]) => [sourceId, metadata])
) as Record<keyof typeof QUOTE_SOURCES, SourceMetadata>;

export type DefaultSourcesConfig = Without<SourcesConfig, undefined>;
export function buildSources(config?: GlobalQuoteSourceConfig & Partial<DefaultSourcesConfig>) {
  const sources: Record<SourceId, QuoteSource<QuoteSourceSupport, any>> = {};
  for (const sourceId in QUOTE_SOURCES) {
    const { build, needsConfig }: QuoteSourceBuilder<any> = QUOTE_SOURCES[sourceId as keyof typeof QUOTE_SOURCES];
    if (!needsConfig || (config && sourceId in config)) {
      sources[sourceId] = build({
        global: config ?? {},
        custom: config && (config as any)[sourceId],
      });
    }
  }
  return sources;
}

function builder<Source extends QuoteSource<any, any>>(
  metadata: QuoteSourceMetadata<GetSupportFromSource<Source>>,
  build: (config: { custom: GetCustomConfigFromSource<Source>; global: GlobalQuoteSourceConfig }) => Source
): QuoteSourceBuilder<Source> {
  return { metadata, build, needsConfig: false };
}
function builderNeedsConfig<Source extends QuoteSource<any, any>>(
  metadata: QuoteSourceMetadata<GetSupportFromSource<Source>>,
  build: (config: { custom: GetCustomConfigFromSource<Source>; global: GlobalQuoteSourceConfig }) => Source
): QuoteSourceBuilder<Source> {
  return { metadata, build, needsConfig: true };
}

type ImplementedSources = typeof QUOTE_SOURCES;
type SourcesConfig = {
  [K in keyof ImplementedSources]: ImplementedSources[K] extends QuoteSourceBuilder<any> ? GetConfigFromBuilder<ImplementedSources[K]> : never;
};
type GetSourceFromBuilder<T extends QuoteSourceBuilder<any>> = T extends QuoteSourceBuilder<infer Source> ? Source : never;
type QuoteSourceBuilder<Source extends QuoteSource<any, any>> = {
  metadata: QuoteSourceMetadata<GetSupportFromSource<Source>>;
  build: (config: { custom: GetCustomConfigFromSource<Source>; global: GlobalQuoteSourceConfig }) => Source;
  needsConfig: boolean;
};
type GetConfigFromBuilder<T extends QuoteSourceBuilder<any>> = GetCustomConfigFromSource<GetSourceFromBuilder<T>>;
type GetCustomConfigFromSource<T extends QuoteSource<any, any>> = T extends QuoteSource<any, infer CustomQuoteSourceConfig>
  ? CustomQuoteSourceConfig
  : never;
type GetSupportFromSource<T extends QuoteSource<any, any>> = T extends QuoteSource<infer SourceSupport, any> ? SourceSupport : never;
