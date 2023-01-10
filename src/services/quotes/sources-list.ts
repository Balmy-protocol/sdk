import { Without } from "@utility-types";
import { QuoteSource, QuoteSourceSupport } from "./quote-sources/base";
import { OdosQuoteSource } from "./quote-sources/odos";
import { ParaswapQuoteSource } from "./quote-sources/paraswap";
import { AvailableSources, GlobalQuoteSourceConfig, QuoteSourcesList } from "./types";

export const QUOTE_SOURCES = {
  odos: builderNeedsConfig<OdosQuoteSource>((config) => new OdosQuoteSource(config)),
  paraswap: builder<ParaswapQuoteSource>((config) => new ParaswapQuoteSource(config)),

} satisfies Record<string, QuoteSourceBuilder<any, any, any, any>>

export function buildSources<Config extends Partial<AllSourcesConfig>>(global: GlobalQuoteSourceConfig, custom: Config) {
  const sources: Record<SourcesBasedOnConfig<Config>, QuoteSource<any, any, any>> = {} as any
  for (const key in QUOTE_SOURCES) {
    const sourceId = key as AvailableSources
    const { build, needsConfig } = QUOTE_SOURCES[sourceId] as QuoteSourceBuilder<any, any, any, any>
    if (!needsConfig || key in custom) {
      sources[sourceId] = build({ global, custom: (custom as any)[key] })
    }
  }
  return sources
}

export type AllSourcesConfig = Without<AllSourcesConfigWithNever, never>
export type SourcesBasedOnConfig<Config extends Partial<AllSourcesConfig>> = (keyof Config | SourcesWithoutNeededConfig) & AvailableSources

function builder<
  Source extends QuoteSource<Support, false, CustomQuoteSourceConfig>,
  Support extends QuoteSourceSupport = GetSupportFromSource<Source>,
  CustomQuoteSourceConfig = GetCustomConfigFromSource<Source>,
>(build: (config: { custom: CustomQuoteSourceConfig, global: GlobalQuoteSourceConfig }) => Source): QuoteSourceBuilder<Source, Support, false, CustomQuoteSourceConfig> {
  return { build, needsConfig: false }
}
function builderNeedsConfig<
  Source extends QuoteSource<Support, true, CustomQuoteSourceConfig>,
  Support extends QuoteSourceSupport = GetSupportFromSource<Source>,
  CustomQuoteSourceConfig = GetCustomConfigFromSource<Source>,
>(build: (config: { custom: CustomQuoteSourceConfig, global: GlobalQuoteSourceConfig }) => Source): QuoteSourceBuilder<Source, Support, true, CustomQuoteSourceConfig> {
  return { build, needsConfig: true }
}

type SourcesWithoutNeededConfig = {
  [K in keyof QuoteSourcesList]:
  GetCustomConfigNeededFomBuilder<QuoteSourcesList[K]> extends false
  ? K
  : never
}[AvailableSources];
type AllSourcesConfigWithNever = {
  [K in keyof QuoteSourcesList]:
  GetConfigFromBuilder<QuoteSourcesList[K]> extends undefined
  ? never
  : GetConfigFromBuilder<QuoteSourcesList[K]>
};
type QuoteSourceBuilder<
  Source extends QuoteSource<Support, CustomConfigNeeded, CustomQuoteSourceConfig>,
  Support extends QuoteSourceSupport = GetSupportFromSource<Source>,
  CustomConfigNeeded extends boolean = GetCustomConfigNeededFromSource<Source>,
  CustomQuoteSourceConfig = GetCustomConfigFromSource<Source>,
> = { build: (config: { custom: CustomQuoteSourceConfig, global: GlobalQuoteSourceConfig }) => Source, needsConfig: CustomConfigNeeded }
type GetConfigFromBuilder<T extends QuoteSourceBuilder<any, any, any, any>> = T extends QuoteSourceBuilder<any, any, any, infer CustomQuoteSourceConfig> ? CustomQuoteSourceConfig : never
type GetCustomConfigNeededFomBuilder<T extends QuoteSourceBuilder<any, any, any, any>> = T extends QuoteSourceBuilder<any, any, infer CustomConfigNeeded, any> ? CustomConfigNeeded : never
type GetCustomConfigNeededFromSource<T extends QuoteSource<any, any, any>> = T extends QuoteSource<any, infer CustomConfigNeeded, any> ? CustomConfigNeeded : never
type GetSupportFromSource<T extends QuoteSource<any, any, any>> = T extends QuoteSource<infer Support, any, any> ? Support : never
type GetCustomConfigFromSource<T extends QuoteSource<any, any, any>> = T extends QuoteSource<any, any, infer CustomQuoteSourceConfig> ? CustomQuoteSourceConfig : never