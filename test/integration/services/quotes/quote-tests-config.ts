import { chainsUnion } from '@chains';
import { LocalSourcesConfig, buildSources } from '@services/quotes/source-registry';
import { GlobalQuoteSourceConfig } from '@services/quotes/types';

export const CONFIG: GlobalQuoteSourceConfig & Partial<LocalSourcesConfig> = {
  odos: { sourceBlacklist: ['Hashflow'] },
  referrer: { address: '0x0000000000000000000000000000000000000001', name: 'IntegrationTest' },
};
if (process.env.RANGO_API_KEY) {
  CONFIG.rango = { apiKey: process.env.RANGO_API_KEY };
}
if (process.env.FIREBIRD_API_KEY) {
  CONFIG.firebird = { apiKey: process.env.FIREBIRD_API_KEY };
}
if (process.env.CHANGELLY_API_KEY) {
  CONFIG.changelly = { apiKey: process.env.CHANGELLY_API_KEY };
}

export function supportedChains() {
  const sources = buildSources(CONFIG);
  return chainsUnion(Object.values(sources).map((source) => source.getMetadata().supports.chains));
}

export enum Test {
  SELL_STABLE_TO_NATIVE,
  SELL_NATIVE_TO_RANDOM_ERC20,
  BUY_NATIVE_WITH_STABLE,
  WRAP_NATIVE_TOKEN,
  UNWRAP_WTOKEN,
  SELL_NATIVE_TO_STABLE_AND_TRANSFER,
}

export const EXCEPTIONS: Partial<Record<string, Test[]>> = {
  uniswap: [Test.WRAP_NATIVE_TOKEN, Test.UNWRAP_WTOKEN],
  kyberswap: [Test.WRAP_NATIVE_TOKEN, Test.UNWRAP_WTOKEN],
};
