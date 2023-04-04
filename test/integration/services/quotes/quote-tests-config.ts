import { chainsUnion } from '@chains';
import { QUOTE_SOURCES, SourceConfig } from '@services/quotes/source-registry';

export const CONFIG: SourceConfig = {
  global: {
    referrer: { address: '0x0000000000000000000000000000000000000001', name: 'IntegrationTest' },
  },
  custom: {
    odos: { sourceBlacklist: ['Hashflow'] },
  },
};
if (process.env.RANGO_API_KEY) {
  CONFIG.custom!.rango = { apiKey: process.env.RANGO_API_KEY };
}
if (process.env.FIREBIRD_API_KEY) {
  CONFIG.custom!.firebird = { apiKey: process.env.FIREBIRD_API_KEY };
}
if (process.env.CHANGELLY_API_KEY) {
  CONFIG.custom!.changelly = { apiKey: process.env.CHANGELLY_API_KEY };
}

export function supportedChains() {
  const sources = QUOTE_SOURCES;
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
