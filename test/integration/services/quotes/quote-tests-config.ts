import { chainsUnion } from '@chains';
import { QUOTE_SOURCES, SourceConfig, SourceWithConfigId } from '@services/quotes/source-registry';

export const CONFIG: SourceConfig = {
  global: {
    referrer: { address: '0x0000000000000000000000000000000000000001', name: 'IntegrationTest' },
    disableValidation: true,
  },
  custom: {
    odos: { sourceDenylist: ['Hashflow'] },
  },
};
if (process.env.RANGO_API_KEY) {
  CONFIG.custom!.rango = { apiKey: process.env.RANGO_API_KEY };
}
if (process.env.CHANGELLY_API_KEY) {
  CONFIG.custom!.changelly = { apiKey: process.env.CHANGELLY_API_KEY };
}
if (process.env.ZRX_API_KEY) {
  CONFIG.custom!['0x'] = { apiKey: process.env.ZRX_API_KEY };
}
if (process.env.ONE_INCH_KEY) {
  CONFIG.custom!['1inch'] = { apiKey: process.env.ONE_INCH_KEY };
}
if (process.env.PORTALS_FI_API_KEY) {
  CONFIG.custom!['portals-fi'] = { apiKey: process.env.PORTALS_FI_API_KEY };
}
if (process.env.DODO_API_KEY) {
  CONFIG.custom!.dodo = { apiKey: process.env.DODO_API_KEY };
}
if (process.env.BEBOP_API_KEY) {
  CONFIG.custom!.bebop = { apiKey: process.env.BEBOP_API_KEY };
}
if (process.env.ENSO_API_KEY) {
  CONFIG.custom!.enso = { apiKey: process.env.ENSO_API_KEY };
}
if (process.env.BARTER_AUTH_HEADER && process.env.BARTER_CUSTOM_SUBDOMAIN) {
  CONFIG.custom!.barter = {
    authHeader: process.env.BARTER_AUTH_HEADER,
    sourceDenylist: ['Hashflow'],
  };
}
if (process.env.SQUID_INTEGRATOR_ID) {
  CONFIG.custom!.squid = { integratorId: process.env.SQUID_INTEGRATOR_ID };
}
if (process.env.OKX_DEX_API_KEY && process.env.OKX_DEX_SECRET_KEY && process.env.OKX_DEX_PASSPHRASE) {
  CONFIG.custom!['okx-dex'] = {
    apiKey: process.env.OKX_DEX_API_KEY,
    secretKey: process.env.OKX_DEX_SECRET_KEY,
    passphrase: process.env.OKX_DEX_PASSPHRASE,
  };
}
if (process.env.FLY_API_KEY) {
  CONFIG.custom!['fly-trade'] = { apiKey: process.env.FLY_API_KEY };
}

export enum Test {
  SELL_RANDOM_ERC20_TO_STABLE,
  SELL_STABLE_TO_NATIVE,
  SELL_NATIVE_TO_RANDOM_ERC20,
  BUY_NATIVE_WITH_STABLE,
  BUY_RANDOM_ERC20_WITH_STABLE,
  WRAP_NATIVE_TOKEN,
  UNWRAP_WTOKEN,
  SELL_NATIVE_TO_STABLE_AND_TRANSFER,
}

export const EXCEPTIONS: Partial<Record<string, Test[]>> = {
  uniswap: [Test.WRAP_NATIVE_TOKEN, Test.UNWRAP_WTOKEN],
  kyberswap: [Test.WRAP_NATIVE_TOKEN, Test.UNWRAP_WTOKEN],
  sovryn: [Test.WRAP_NATIVE_TOKEN, Test.UNWRAP_WTOKEN],
  oku: [Test.WRAP_NATIVE_TOKEN, Test.UNWRAP_WTOKEN],
  balmy: [
    Test.SELL_RANDOM_ERC20_TO_STABLE,
    Test.SELL_STABLE_TO_NATIVE,
    Test.SELL_NATIVE_TO_RANDOM_ERC20,
    Test.SELL_NATIVE_TO_STABLE_AND_TRANSFER,
    Test.BUY_NATIVE_WITH_STABLE,
    Test.BUY_RANDOM_ERC20_WITH_STABLE,
  ],
};
