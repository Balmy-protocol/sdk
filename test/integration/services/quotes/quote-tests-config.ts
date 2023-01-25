import { AvailableSources, GlobalQuoteSourceConfig } from '@services/quotes/types';
import { AllSourcesConfig } from '@services/quotes/sources-list';

export const CONFIG: GlobalQuoteSourceConfig & Partial<AllSourcesConfig> = {};
if (process.env.ODOS_API_KEY) {
  CONFIG.odos = { apiKey: process.env.ODOS_API_KEY };
}

export enum Test {
  SELL_USDC_TO_NATIVE,
  SELL_NATIVE_TO_RANDOM_ERC20,
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
