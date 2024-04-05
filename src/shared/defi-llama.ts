import { ChainId, TimeString, TokenAddress, Timestamp } from '@types';
import { Addresses } from '@shared/constants';
import { Chains } from '@chains';
import { IFetchService } from '@services/fetch/types';
import { isSameAddress, splitInChunks, timeToSeconds } from '@shared/utils';
import { PriceResult } from '@services/prices';

const CHAIN_ID_TO_KEY: Record<ChainId, Lowercase<string>> = {
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
  [Chains.BASE.chainId]: 'base',
  [Chains.LINEA.chainId]: 'linea',
  [Chains.MODE.chainId]: 'mode',
  [Chains.BLAST.chainId]: 'blast',
  [Chains.SCROLL.chainId]: 'scroll',

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

  getChart({
    tokens,
    span,
    period,
    bound,
    searchWidth,
    config,
  }: {
    tokens: Record<ChainId, TokenAddress[]>;
    span: number;
    period: TimeString;
    bound: { from: Timestamp } | { upTo: Timestamp | 'now' };
    searchWidth?: TimeString;
    config?: { timeout?: TimeString };
  }): Promise<Record<ChainId, Record<TokenAddress, PriceResult[]>>> {
    const extraParams: Record<string, string> = {
      span: span.toString(),
      period: period.toString(),
      ...('from' in bound && { start: bound.from.toString() }),
      ...('upTo' in bound && { end: bound.upTo === 'now' ? Date.now().toString() : bound.upTo.toString() }),
      ...(searchWidth && { searchWidth }),
    };

    return this.fetchAndMapPrices({
      baseUrl: `https://coins.llama.fi/chart/`,
      addresses: tokens,
      extraParams,
      config,
    });
  }

  async getBulkHistoricalTokenData({
    addresses,
    searchWidth,
    config,
  }: {
    addresses: Record<ChainId, { token: TokenAddress; timestamp: Timestamp }[]>;
    searchWidth?: TimeString;
    config?: { timeout?: TimeString };
  }) {
    searchWidth = searchWidth ?? '6h';
    const aggregatedByTokenId = aggregateTimestampsByTokenId(addresses);

    const batches = splitCoinsIntoBatches(searchWidth, aggregatedByTokenId);

    const coins: Record<TokenId, PriceResult[]> = {};
    const promises = batches.map(async (batch) => {
      const response = await this.fetch.fetch(batch, { timeout: config?.timeout });
      const body: BatchHistoricalResult = await response.json();
      for (const [tokenId, { prices }] of Object.entries(body.coins)) {
        if (!(tokenId in coins)) coins[tokenId] = [];
        coins[tokenId].push(...prices.map(({ timestamp, price }) => ({ price, closestTimestamp: timestamp })));
      }
    });
    await Promise.allSettled(promises);

    const result: Record<ChainId, Record<TokenAddress, Record<Timestamp, PriceResult>>> = {};
    for (const chainId in addresses) {
      result[chainId] = {};
      for (const { token, timestamp } of addresses[chainId]) {
        if (!(token in result[chainId])) result[chainId][token] = {};
        const tokenId = toTokenId(Number(chainId), token);
        const allResults = coins[tokenId] ?? [];
        const bestResult = findClosestToTimestamp(allResults, timestamp);
        if (bestResult && Math.abs(bestResult.closestTimestamp - timestamp) <= timeToSeconds(searchWidth)) {
          result[chainId][token][timestamp] = bestResult;
        }
      }
    }
    return result;
  }

  async getClosestBlock(chainId: ChainId, timestamp: Timestamp) {
    const chainKey = CHAIN_ID_TO_KEY[chainId];
    if (!chainKey) throw new Error(`Chain with id ${chainId} not supported`);
    const result = await this.fetch.fetch(`https://coins.llama.fi/block/${chainKey}/${timestamp}`);
    const { height, timestamp: blockTimestamp } = await result.json();
    return { block: BigInt(height), timestamp: blockTimestamp };
  }

  private async fetchAndMapPrices({
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
    const tokensPrices = (await this.fetchTokens(baseUrl, tokenIds, config, extraParams)) as Record<string, FetchPricesResult>;
    const result: Record<ChainId, Record<TokenAddress, PriceResult[]>> = Object.fromEntries(
      Object.keys(addresses).map((chainId) => [chainId, {}])
    );

    for (const chainIdString in addresses) {
      const chainId = Number(chainIdString);
      for (const token of addresses[chainId]) {
        const tokenId = toTokenId(chainId, token);
        const tokenPrices = tokensPrices[tokenId];
        if (tokenPrices) {
          result[chainId][token] = tokenPrices.prices.map((price) => ({ price: price.price, closestTimestamp: price.timestamp }));
        }
      }
    }
    return result;
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
    for (const chainIdString in addresses) {
      const chainId = Number(chainIdString);
      for (const token of addresses[chainId]) {
        const tokenId = toTokenId(chainId, token);
        const coin = coins[tokenId];
        if (coin) {
          result[chainId][token] = { decimals: 18, ...coin };
        }
      }
    }
    return result;
  }

  private async fetchTokens(baseUrl: string, tokens: TokenId[], config?: { timeout?: TimeString }, extraParams: Record<string, string> = {}) {
    const chunks = splitInChunks(tokens, 30);
    const extraParamsString =
      '?' +
      Object.entries(extraParams)
        .map(([key, value]) => `${key}=${value}`)
        .join('&');
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
const MAPPINGS: Record<Lowercase<TokenId>, Lowercase<TokenId>> = {
  'polygon:0x2791bca1f2de4661ed88a30c99a7a9449aa84174': 'polygon:0x3c499c542cef5e3811e1192ce70d8cc03d5c3359', // Bridged USDC (USDC.e): Native USDC
  'arbitrum:0xff970a61a04b1ca14834a43f5de4533ebddb5cc8': 'arbitrum:0xaf88d065e77c8cc2239327c5edb3a432268e5831', // Bridged USDC (USDC.e): Native USDC
  'optimism:0x7f5c764cbc14f9669b88837ca1490cca17c31607': 'optimism:0x0b2c639c533813f4aa9d7837caf62653d097ff85', // Bridged USDC (USDC.e): Native USDC
};

function splitCoinsIntoBatches(searchWidth: string | undefined, aggregatedByTokenId: { tokenId: string; timestamps: number[] }[]) {
  const searchWidthParam = searchWidth ? `&searchWidth=${searchWidth}` : '';
  const toURL = (coins: Record<TokenId, Timestamp[]>) =>
    `https://coins.llama.fi/batchHistorical?&coins=${encodeURIComponent(JSON.stringify(coins))}${searchWidthParam}`;

  const batches: string[] = [];

  let inBatch: Record<TokenId, Timestamp[]> = {};
  for (const { tokenId, timestamps } of aggregatedByTokenId) {
    const ifAddedToBatch = { ...inBatch, [tokenId]: timestamps };
    const url = toURL(ifAddedToBatch);
    if (url.length > 2048) {
      if (Object.keys(inBatch).length > 0) {
        // If was something on the batch already, then close the batch
        batches.push(toURL(inBatch));
        inBatch = {};
      } else {
        // If there was nothing already on the batch, then we have a token too big for a batch, we'll need to split it
        const chunks = splitInChunks(timestamps, 140);
        batches.push(...chunks.map((chunk) => toURL({ [tokenId]: chunk })));
      }
    } else {
      inBatch = ifAddedToBatch;
    }
  }
  if (Object.keys(inBatch).length > 0) {
    // If there was anything left, add it
    batches.push(toURL(inBatch));
  }
  return batches;
}

function aggregateTimestampsByTokenId(addresses: Record<number, { token: TokenAddress; timestamp: Timestamp }[]>) {
  const aggregatedByTokenId: Record<TokenId, Timestamp[]> = {};
  for (const chainId in addresses) {
    for (const { token, timestamp } of addresses[chainId]) {
      const tokenId = toTokenId(Number(chainId), token);
      if (!(tokenId in aggregatedByTokenId)) aggregatedByTokenId[tokenId] = [];
      aggregatedByTokenId[tokenId].push(timestamp);
    }
  }
  return Object.entries(aggregatedByTokenId)
    .map(([tokenId, timestamps]) => ({ tokenId, timestamps }))
    .sort((a, b) => a.timestamps.length - b.timestamps.length);
}

function findClosestToTimestamp(allResults: PriceResult[], timestamp: Timestamp) {
  if (allResults.length == 0) return undefined;

  let min = allResults[0];
  for (let i = 1; i < allResults.length; i++) {
    if (Math.abs(allResults[i].closestTimestamp - timestamp) < Math.abs(min.closestTimestamp - timestamp)) {
      min = allResults[i];
    }
  }
  return min;
}

function toTokenId(chainId: ChainId, address: TokenAddress) {
  const key = CHAIN_ID_TO_KEY[chainId];
  const toMap = (
    isSameAddress(address, Addresses.NATIVE_TOKEN) ? `${key}:${DEFI_LLAMA_NATIVE_TOKEN}` : `${key}:${address.toLowerCase()}`
  ) as Lowercase<TokenId>;
  return MAPPINGS[toMap] ?? toMap;
}

export function toChainId(key: string): ChainId {
  return KEY_TO_CHAIN_ID[key.toLowerCase()];
}

type BatchHistoricalResult = { coins: Record<TokenId, { prices: { timestamp: Timestamp; price: number }[] }> };

type FetchTokenResult = {
  decimals?: number;
  price: number;
  symbol: string;
  timestamp: number;
  confidence: number;
};
type FetchPricesResult = FetchTokenResult & {
  prices: { price: number; timestamp: number }[];
};
type TokenId = string;
