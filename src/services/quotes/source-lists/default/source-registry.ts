import { GlobalQuoteSourceConfig, SourceId } from '../../types';
import { OdosQuoteSource } from '../../quote-sources/odos';
import { ParaswapQuoteSource } from '../../quote-sources/paraswap';
import { ZRXQuoteSource } from '../../quote-sources/0x';
import { OneInchQuoteSource } from '../../quote-sources/1inch';
import { UniswapQuoteSource } from '../../quote-sources/uniswap';
import { OpenOceanQuoteSource } from '../../quote-sources/open-ocean';
import { LiFiQuoteSource } from '../../quote-sources/li-fi';
import { KyberswapQuoteSource } from '../../quote-sources/kyberswap';
import { Without } from '@utility-types';
import { QuoteSource, QuoteSourceSupport } from '../../quote-sources/base';
import { FirebirdQuoteSource } from '@services/quotes/quote-sources/firebird';

const QUOTE_SOURCES = {
  paraswap: builder<ParaswapQuoteSource>((config) => new ParaswapQuoteSource(config)),
  '0x': builder<ZRXQuoteSource>((config) => new ZRXQuoteSource(config)),
  '1inch': builder<OneInchQuoteSource>((config) => new OneInchQuoteSource(config)),
  uniswap: builder<UniswapQuoteSource>((config) => new UniswapQuoteSource(config)),
  'open-ocean': builder<OpenOceanQuoteSource>((config) => new OpenOceanQuoteSource(config)),
  'li-fi': builder<LiFiQuoteSource>((config) => new LiFiQuoteSource(config)),
  kyberswap: builder<KyberswapQuoteSource>((config) => new KyberswapQuoteSource(config)),
  odos: builderNeedsConfig<OdosQuoteSource>((config) => new OdosQuoteSource(config)),
  firebird: builderNeedsConfig<FirebirdQuoteSource>((config) => new FirebirdQuoteSource(config)),
} satisfies Record<SourceId, QuoteSourceBuilder<any>>;

export type AllSourcesConfig = Without<SourcesConfig, undefined>;
export function buildSources(config?: GlobalQuoteSourceConfig & Partial<AllSourcesConfig>) {
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
  build: (config: { custom: GetCustomConfigFromSource<Source>; global: GlobalQuoteSourceConfig }) => Source
): QuoteSourceBuilder<Source> {
  return { build, needsConfig: false };
}
function builderNeedsConfig<Source extends QuoteSource<any, any>>(
  build: (config: { custom: GetCustomConfigFromSource<Source>; global: GlobalQuoteSourceConfig }) => Source
): QuoteSourceBuilder<Source> {
  return { build, needsConfig: true };
}

type ImplementedSources = typeof QUOTE_SOURCES;
type SourcesConfig = {
  [K in keyof ImplementedSources]: ImplementedSources[K] extends QuoteSourceBuilder<any> ? GetConfigFromBuilder<ImplementedSources[K]> : never;
};
type GetSourceFromBuilder<T extends QuoteSourceBuilder<any>> = T extends QuoteSourceBuilder<infer Source> ? Source : never;
type QuoteSourceBuilder<Source extends QuoteSource<any, any>> = {
  build: (config: { custom: GetCustomConfigFromSource<Source>; global: GlobalQuoteSourceConfig }) => Source;
  needsConfig: boolean;
};
type GetConfigFromBuilder<T extends QuoteSourceBuilder<any>> = GetCustomConfigFromSource<GetSourceFromBuilder<T>>;
type GetCustomConfigFromSource<T extends QuoteSource<any, any>> = T extends QuoteSource<any, infer CustomQuoteSourceConfig>
  ? CustomQuoteSourceConfig
  : never;
