import { ChainId } from '@types';
import { AvailableSources, GlobalQuoteSourceConfig } from '@services/quotes/types';
import { AllSourcesConfig, buildSources } from '@services/quotes/sources-list';
import { QuoteSource, QuoteSourceSupport } from '@services/quotes/quote-sources/base';
import { TOKENS } from '@test-utils/erc20';

export const CONFIG: GlobalQuoteSourceConfig & Partial<AllSourcesConfig> = {};
if (process.env.ODOS_API_KEY) {
  CONFIG.odos = { apiKey: process.env.ODOS_API_KEY };
}

export enum Test {
  SELL_USDC_TO_NATIVE,
  SELL_NATIVE_TO_WBTC,
  BUY_WTOKEN_WITH_NATIVE,
  BUY_NATIVE_WITH_WTOKEN,
  BUY_NATIVE_WITH_USDC,
  WRAP_NATIVE_TOKEN,
  UNWRAP_WTOKEN,
  SELL_NATIVE_TO_USDC_AND_TRANSFER,
  WRAP_NATIVE_TOKEN_AND_TRANSFER,
  UNWRAP_WTOKEN_AND_TRANSFER,
}

export const EXCEPTIONS: Partial<Record<AvailableSources, Test[]>> = {
  ['uniswap']: [
    Test.BUY_WTOKEN_WITH_NATIVE,
    Test.BUY_NATIVE_WITH_WTOKEN,
    Test.WRAP_NATIVE_TOKEN,
    Test.UNWRAP_WTOKEN,
    Test.WRAP_NATIVE_TOKEN_AND_TRANSFER,
    Test.UNWRAP_WTOKEN_AND_TRANSFER,
  ],
};

export function getAllSources() {
  const sources = buildSources(CONFIG, CONFIG);
  const result: Record<ChainId, Record<AvailableSources, QuoteSource<QuoteSourceSupport, any, any>>> = {};
  for (const [sourceId, source] of Object.entries(sources)) {
    for (const chain of source.getMetadata().supports.chains) {
      if (!(chain.chainId in result)) {
        result[chain.chainId] = {} as any;
      }
      result[chain.chainId][sourceId as AvailableSources] = source;
    }
  }
  for (const chainId in result) {
    if (!(chainId in TOKENS)) {
      delete result[chainId];
    }
  }
  return result;
}
