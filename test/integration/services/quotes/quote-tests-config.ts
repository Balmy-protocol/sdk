import { chainsUnion } from '@chains';
import { DefaultSourcesConfig, buildSources } from '@services/quotes/source-registry';
import { GlobalQuoteSourceConfig } from '@services/quotes/types';

export const CONFIG: GlobalQuoteSourceConfig & Partial<DefaultSourcesConfig> = {
  referrerAddress: '0x0000000000000000000000000000000000000001',
};
if (process.env.ODOS_API_KEY) {
  CONFIG.odos = { apiKey: process.env.ODOS_API_KEY };
}
if (process.env.RANGO_API_KEY) {
  CONFIG.rango = { apiKey: process.env.RANGO_API_KEY };
}
if (process.env.FIREBIRD_API_KEY) {
  CONFIG.firebird = { apiKey: process.env.FIREBIRD_API_KEY };
}

export function supportedChains() {
  const sources = buildSources(CONFIG);
  return chainsUnion(Object.values(sources).map((source) => source.getMetadata().supports.chains.map(({ chainId }) => chainId)));
}

export enum Test {
  SELL_USDC_TO_NATIVE,
  SELL_NATIVE_TO_RANDOM_ERC20,
  BUY_NATIVE_WITH_USDC,
  WRAP_NATIVE_TOKEN,
  UNWRAP_WTOKEN,
  SELL_NATIVE_TO_USDC_AND_TRANSFER,
}

export const EXCEPTIONS: Partial<Record<string, Test[]>> = {
  uniswap: [Test.WRAP_NATIVE_TOKEN, Test.UNWRAP_WTOKEN],
  kyberswap: [Test.WRAP_NATIVE_TOKEN, Test.UNWRAP_WTOKEN],
};
