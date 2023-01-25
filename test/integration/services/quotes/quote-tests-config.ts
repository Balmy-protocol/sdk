import { AvailableSources, GlobalQuoteSourceConfig } from '@services/quotes/types';
import { AllSourcesConfig } from '@services/quotes/sources-list';

export const CONFIG: GlobalQuoteSourceConfig & Partial<AllSourcesConfig> = {};
if (process.env.ODOS_API_KEY) {
  CONFIG.odos = { apiKey: process.env.ODOS_API_KEY };
}
if (process.env.RANGO_API_KEY) {
  CONFIG.rango = { apiKey: process.env.RANGO_API_KEY };
}

export enum Test {
  SELL_USDC_TO_NATIVE,
  SELL_NATIVE_TO_RANDOM_ERC20,
  BUY_NATIVE_WITH_USDC,
  WRAP_NATIVE_TOKEN,
  UNWRAP_WTOKEN,
  SELL_NATIVE_TO_USDC_AND_TRANSFER,
}

export const EXCEPTIONS: Partial<Record<AvailableSources, Test[]>> = {
  uniswap: [Test.WRAP_NATIVE_TOKEN, Test.UNWRAP_WTOKEN],
  kyberswap: [Test.WRAP_NATIVE_TOKEN, Test.UNWRAP_WTOKEN],
};
