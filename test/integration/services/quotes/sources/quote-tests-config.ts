import { Chains } from '@chains';
import { TokenAddress, ChainId, Address } from '@types';
import { AvailableSources, GlobalQuoteSourceConfig } from '@services/quotes/types';
import { AllSourcesConfig, buildSources } from '@services/quotes/sources-list';
import { QuoteSource, QuoteSourceSupport } from '@services/quotes/quote-sources/base';

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

type TokenData = { address: TokenAddress; whale: Address };
type ChainTokens = { WBTC: TokenData; USDC: TokenData; wToken: TokenData };
// TODO: Add more chains
export const TOKENS: Record<ChainId, Record<string, TokenData>> = {
  [Chains.ETHEREUM.chainId]: {
    USDC: {
      address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
      whale: '0xf977814e90da44bfa03b6295a0616a897441acec',
    },
    WBTC: {
      address: '0x2260fac5e5542a773aa44fbcfedf7c193bc2c599',
      whale: '0x218b95be3ed99141b0144dba6ce88807c4ad7c09',
    },
    wToken: {
      address: '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2',
      whale: '0x08638ef1a205be6762a8b935f5da9b700cf7322c',
    },
  },
  [Chains.OPTIMISM.chainId]: {
    USDC: {
      address: '0x7f5c764cbc14f9669b88837ca1490cca17c31607',
      whale: '0xf390830df829cf22c53c8840554b98eafc5dcbc2',
    },
    WBTC: {
      address: '0x68f180fcCe6836688e9084f035309E29Bf0A2095',
      whale: '0x338726dd694db9e2230ec2bb8624a2d7f566c96d',
    },
    wToken: {
      address: '0x4200000000000000000000000000000000000006',
      whale: '0x68f5c0a2de713a54991e01858fd27a3832401849',
    },
  },
  [Chains.POLYGON.chainId]: {
    USDC: {
      address: '0x2791bca1f2de4661ed88a30c99a7a9449aa84174',
      whale: '0xe7804c37c13166ff0b37f5ae0bb07a3aebb6e245',
    },
    WBTC: {
      address: '0x1bfd67037b42cf73acf2047067bd4f2c47d9bfd6',
      whale: '0x5c2ed810328349100a66b82b78a1791b101c9d61',
    },
    wToken: {
      address: '0x0d500b1d8e8ef31e21c99d1db9a6444d3adf1270',
      whale: '0x8df3aad3a84da6b69a4da8aec3ea40d9091b2ac4',
    },
  },
} satisfies Record<ChainId, ChainTokens>;

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
