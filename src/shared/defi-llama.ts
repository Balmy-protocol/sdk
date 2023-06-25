import { ChainId, TimeString, TokenAddress, Timestamp } from '@types';
import { Addresses } from '@shared/constants';
import { Chains } from '@chains';
import { IFetchService } from '@services/fetch/types';
import { isSameAddress } from '@shared/utils';

const CHAIN_ID_TO_KEY: Record<ChainId, string> = {
  [Chains.ETHEREUM.chainId]: 'ethereum',
  [Chains.BNB_CHAIN.chainId]: 'bsc',
  [Chains.POLYGON.chainId]: 'polygon',
  [Chains.AVALANCHE.chainId]: 'avax',
  [Chains.FANTOM.chainId]: 'fantom',
  [Chains.GNOSIS.chainId]: 'xdai',
  [Chains.HECO.chainId]: 'heco',
  [Chains.ARBITRUM.chainId]: 'arbitrum',
  [Chains.OPTIMISM.chainId]: 'optimism',
  [Chains.CELO.chainId]: 'celo',
  [Chains.CRONOS.chainId]: 'cronos',
  [Chains.BOBA.chainId]: 'boba',
  [Chains.MOONRIVER.chainId]: 'moonriver',
  [Chains.OKC.chainId]: 'okexchain',
  [Chains.ONTOLOGY.chainId]: 'ontology',
  [Chains.KLAYTN.chainId]: 'klaytn',
  [Chains.AURORA.chainId]: 'aurora',
  [Chains.HARMONY_SHARD_0.chainId]: 'harmony',
  [Chains.MOONBEAM.chainId]: 'moonbeam',
  [Chains.VELAS.chainId]: 'velas',
  [Chains.ROOTSTOCK.chainId]: 'rsk',
  [Chains.EVMOS.chainId]: 'evmos',
  [Chains.CANTO.chainId]: 'canto',
  [Chains.POLYGON_ZKEVM.chainId]: 'polygon_zkevm',
  [Chains.KAVA.chainId]: 'kava',

  // TODO: these chains are also supported by DefiLlama. We should add them
  // "kcc",
  // "wan",
  // "kardia",
  // "metis",
  // "telos",
  // "meter",
  // "sx",
  // "milkomeda"
};

const KEY_TO_CHAIN_ID: Record<string, ChainId> = Object.fromEntries(
  Object.entries(CHAIN_ID_TO_KEY).map(([chainId, key]) => [key, parseInt(chainId)])
);

export class DefiLlamaClient {
  constructor(private readonly fetch: IFetchService) {}

  supportedChains(): ChainId[] {
    return Object.keys(CHAIN_ID_TO_KEY).map(Number);
  }

  getCurrentTokenData({
    addresses,
    config,
  }: {
    addresses: Record<ChainId, TokenAddress[]>;
    config?: { timeout?: TimeString };
  }): Promise<Record<ChainId, Record<TokenAddress, Required<FetchTokenResult>>>> {
    return this.fetchAndMapTokens({
      baseUrl: 'https://coins.llama.fi/prices/current/',
      addresses,
      config,
    });
  }

  getHistoricalTokenData({
    addresses,
    timestamp,
    searchWidth,
    config,
  }: {
    addresses: Record<ChainId, TokenAddress[]>;
    timestamp: Timestamp;
    searchWidth?: TimeString;
    config?: { timeout?: TimeString };
  }) {
    const extraParams = searchWidth && { searchWidth };
    return this.fetchAndMapTokens({
      baseUrl: `https://coins.llama.fi/prices/historical/${timestamp}/`,
      addresses,
      extraParams,
      config,
    });
  }

  private async fetchAndMapTokens({
    baseUrl,
    addresses,
    extraParams,
    config,
  }: {
    baseUrl: string;
    addresses: Record<ChainId, TokenAddress[]>;
    extraParams?: Record<string, string>;
    config?: { timeout?: TimeString };
  }) {
    const tokenIds = Object.entries(addresses).flatMap(([chainId, addresses]) =>
      addresses.map((address) => toTokenId(Number(chainId), address))
    );
    const coins = await this.fetchTokens(baseUrl, tokenIds, config, extraParams);
    const result: Record<ChainId, Record<TokenAddress, Required<FetchTokenResult>>> = Object.fromEntries(
      Object.keys(addresses).map((chainId) => [chainId, {}])
    );
    for (const [tokenId, token] of Object.entries(coins)) {
      const { chainId, address } = fromTokenId(tokenId);
      if (!isSameAddress(address, Addresses.NATIVE_TOKEN)) {
        result[chainId][address] = { decimals: 18, ...token };
      } else {
        // Since we converted the native token address to 0x000...000 and back, we lost casing. So we need to check for the original casing
        const nativeTokens = addresses[chainId].filter((address) => isSameAddress(address, Addresses.NATIVE_TOKEN));
        for (const nativeToken of nativeTokens) {
          result[chainId][nativeToken] = { decimals: 18, ...token };
        }
      }
    }
    return result;
  }

  private async fetchTokens(baseUrl: string, tokens: TokenId[], config?: { timeout?: TimeString }, extraParams: Record<string, string> = {}) {
    const chunkSize = 30;
    const chunks = [...Array(Math.ceil(tokens.length / chunkSize))].map((_) => tokens.splice(0, chunkSize));
    const extraParamsString =
      '?' +
      Object.entries(extraParams)
        .map(([key, value]) => `${key}=${value}`)
        .join('&=');
    const requests = chunks.map(async (chunk) => {
      const url = baseUrl + chunk.join(',') + extraParamsString;
      try {
        const response = await this.fetch.fetch(url, { timeout: config?.timeout });
        const { coins }: { coins: Record<TokenId, FetchTokenResult> } = await response.json();
        return coins;
      } catch {
        throw new Error('Request to Defi Llama API failed');
      }
    });
    const responses = await Promise.all(requests);
    return responses.reduce((accum, curr) => ({ ...accum, ...curr }), {});
  }
}

const DEFI_LLAMA_NATIVE_TOKEN = '0x0000000000000000000000000000000000000000';
const MAPPINGS: Record<string, string> = {};

function toTokenId(chainId: ChainId, address: TokenAddress) {
  const key = CHAIN_ID_TO_KEY[chainId];
  const mappedNativeToken = isSameAddress(address, Addresses.NATIVE_TOKEN) ? `${key}:${DEFI_LLAMA_NATIVE_TOKEN}` : `${key}:${address}`;
  return MAPPINGS[mappedNativeToken] ?? mappedNativeToken;
}

function fromTokenId(tokenId: TokenId): { chainId: ChainId; address: TokenAddress } {
  const mappedTokenId = MAPPINGS[tokenId] ?? tokenId;
  const [key, address] = mappedTokenId.split(':');
  return {
    chainId: KEY_TO_CHAIN_ID[key],
    address: address.replaceAll(DEFI_LLAMA_NATIVE_TOKEN, Addresses.NATIVE_TOKEN),
  };
}

type FetchTokenResult = {
  decimals?: number;
  price: number;
  symbol: string;
  timestamp: number;
  confidence: number;
};
type TokenId = string;
