import { GlobalQuoteSourceConfig, SourceId, SourceMetadata } from './types';
import { Without } from '@utility-types';
import { IQuoteSource, QuoteSourceSupport } from './quote-sources/types';
import { OdosQuoteSource } from './quote-sources/odos';
import { ParaswapQuoteSource } from './quote-sources/paraswap';
import { ZRXQuoteSource } from './quote-sources/0x';
import { OneInchQuoteSource } from './quote-sources/1inch';
import { UniswapQuoteSource } from './quote-sources/uniswap';
import { OpenOceanQuoteSource } from './quote-sources/open-ocean';
import { LiFiQuoteSource } from './quote-sources/li-fi';
import { KyberswapQuoteSource } from './quote-sources/kyberswap';
import { FirebirdQuoteSource } from '@services/quotes/quote-sources/firebird';
import { RangoQuoteSource } from './quote-sources/rango';
import { ChangellyQuoteSource } from './quote-sources/changelly';

export const QUOTE_SOURCES = {
  paraswap: new ParaswapQuoteSource(),
  '0x': new ZRXQuoteSource(),
  '1inch': new OneInchQuoteSource(),
  uniswap: new UniswapQuoteSource(),
  'open-ocean': new OpenOceanQuoteSource(),
  'li-fi': new LiFiQuoteSource(),
  kyberswap: new KyberswapQuoteSource(),
  odos: new OdosQuoteSource(),
  firebird: new FirebirdQuoteSource(),
  rango: new RangoQuoteSource(),
  changelly: new ChangellyQuoteSource(),
} satisfies Record<SourceId, IQuoteSource<QuoteSourceSupport, any>>;

export const SOURCES_METADATA = Object.fromEntries(
  Object.entries(QUOTE_SOURCES).map(([sourceId, source]) => [sourceId, source.getMetadata()])
) as Record<keyof typeof QUOTE_SOURCES, SourceMetadata>;

export type SourceWithConfigId = keyof LocalSourcesConfig;
export type SourceConfig = { global?: GlobalQuoteSourceConfig; custom?: Partial<LocalSourcesConfig> };
export type LocalSourceConfig = LocalSourcesConfig[keyof LocalSourcesConfig];
type ImplementedSources = typeof QUOTE_SOURCES;
type LocalSourcesConfig = Without<
  { [K in keyof AllLocalSourcesConfig]: ConfigHasKeys<AllLocalSourcesConfig[K]> extends true ? AllLocalSourcesConfig[K] : never },
  never
>;
type AllLocalSourcesConfig = {
  [K in keyof ImplementedSources]: ImplementedSources[K] extends IQuoteSource<any, any>
    ? GetCustomConfigFromSource<ImplementedSources[K]>
    : never;
};
type ConfigHasKeys<CustomQuoteSourceConfig extends object> = keyof CustomQuoteSourceConfig extends never ? false : true;
type GetCustomConfigFromSource<T extends IQuoteSource<any, any>> = T extends IQuoteSource<any, infer CustomQuoteSourceConfig>
  ? CustomQuoteSourceConfig
  : never;
