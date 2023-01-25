import { Without } from '@utility-types';
import { AvailableSources, GlobalQuoteSourceConfig, QuoteSourcesList } from './types';
import { QuoteSource, QuoteSourceSupport } from './quote-sources/base';
import { OdosQuoteSource } from './quote-sources/odos';
import { ParaswapQuoteSource } from './quote-sources/paraswap';
import { ZRXQuoteSource } from './quote-sources/0x';
import { OneInchQuoteSource } from './quote-sources/1inch';
import { UniswapQuoteSource } from './quote-sources/uniswap';
import { OpenOceanQuoteSource } from './quote-sources/open-ocean';
import { LiFiQuoteSource } from './quote-sources/li-fi';
import { KyberswapQuoteSource } from './quote-sources/kyberswap';

export const QUOTE_SOURCES = {
  odos: builderNeedsConfig<OdosQuoteSource>((config) => new OdosQuoteSource(config)),
  paraswap: builder<ParaswapQuoteSource>((config) => new ParaswapQuoteSource(config)),
  '0x': builder<ZRXQuoteSource>((config) => new ZRXQuoteSource(config)),
  '1inch': builder<OneInchQuoteSource>((config) => new OneInchQuoteSource(config)),
  uniswap: builder<UniswapQuoteSource>((config) => new UniswapQuoteSource(config)),
  'open-ocean': builder<OpenOceanQuoteSource>((config) => new OpenOceanQuoteSource(config)),
  'li-fi': builder<LiFiQuoteSource>((config) => new LiFiQuoteSource(config)),
  kyberswap: builder<KyberswapQuoteSource>((config) => new KyberswapQuoteSource(config)),
} satisfies Record<string, QuoteSourceBuilder<any, any, any>>;

export function buildSources(global: GlobalQuoteSourceConfig, custom?: Partial<AllSourcesConfig>) {
  const sources: Record<AvailableSources, QuoteSource<QuoteSourceSupport, any>> = {} as any;
  for (const key in QUOTE_SOURCES) {
    const sourceId = key as AvailableSources;
    const { build, needsConfig } = QUOTE_SOURCES[sourceId] as QuoteSourceBuilder<any, any, any>;
    if (!needsConfig || (custom && sourceId in custom)) {
      sources[sourceId] = build({ global, custom: custom && (custom as any)[sourceId] });
    }
  }
  return sources;
}

export type AllSourcesConfig = Without<AllSourcesConfigWithNever, never>;

function builder<
  Source extends QuoteSource<Support, CustomQuoteSourceConfig>,
  Support extends QuoteSourceSupport = GetSupportFromSource<Source>,
  CustomQuoteSourceConfig = GetCustomConfigFromSource<Source>
>(
  build: (config: { custom: CustomQuoteSourceConfig; global: GlobalQuoteSourceConfig }) => Source
): QuoteSourceBuilder<Source, Support, CustomQuoteSourceConfig> {
  return { build, needsConfig: false };
}
function builderNeedsConfig<
  Source extends QuoteSource<Support, CustomQuoteSourceConfig>,
  Support extends QuoteSourceSupport = GetSupportFromSource<Source>,
  CustomQuoteSourceConfig = GetCustomConfigFromSource<Source>
>(
  build: (config: { custom: CustomQuoteSourceConfig; global: GlobalQuoteSourceConfig }) => Source
): QuoteSourceBuilder<Source, Support, CustomQuoteSourceConfig> {
  return { build, needsConfig: true };
}

type AllSourcesConfigWithNever = {
  [K in keyof QuoteSourcesList]: GetConfigFromBuilder<QuoteSourcesList[K]> extends undefined ? never : GetConfigFromBuilder<QuoteSourcesList[K]>;
};
type QuoteSourceBuilder<
  Source extends QuoteSource<Support, CustomQuoteSourceConfig>,
  Support extends QuoteSourceSupport = GetSupportFromSource<Source>,
  CustomQuoteSourceConfig = GetCustomConfigFromSource<Source>
> = { build: (config: { custom: CustomQuoteSourceConfig; global: GlobalQuoteSourceConfig }) => Source; needsConfig: boolean };
type GetConfigFromBuilder<T extends QuoteSourceBuilder<any, any, any>> = T extends QuoteSourceBuilder<any, any, infer CustomQuoteSourceConfig>
  ? CustomQuoteSourceConfig
  : never;
type GetSupportFromSource<T extends QuoteSource<any, any>> = T extends QuoteSource<infer Support, any> ? Support : never;
export type GetCustomConfigFromSource<T extends QuoteSource<any, any>> = T extends QuoteSource<any, infer CustomQuoteSourceConfig>
  ? CustomQuoteSourceConfig
  : never;
