import { chainsUnion } from '@chains';
import { AllSourcesConfig, buildSources } from '@services/quotes/source-lists/default/source-registry';
import { GlobalQuoteSourceConfig } from '@services/quotes/types';

export const CONFIG: GlobalQuoteSourceConfig & Partial<AllSourcesConfig> = {};
if (process.env.ODOS_API_KEY) {
  CONFIG.odos = { apiKey: process.env.ODOS_API_KEY };
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
