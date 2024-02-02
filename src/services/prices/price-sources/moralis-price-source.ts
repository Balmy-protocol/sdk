import { Address, ChainId, TimeString, Timestamp, TokenAddress } from '@types';
import { Chains, getChainByKey } from '@chains';
import { PriceResult, IPriceSource, PricesQueriesSupport } from '../types';
import { IFetchService } from '@services/fetch';
import { isSameAddress, toTrimmedHex } from '@shared/utils';
import { Addresses } from '@shared/constants';
import { reduceTimeout } from '@shared/timeouts';
import { nowInSeconds } from './utils';

const SUPPORTED_CHAINS = [Chains.ETHEREUM, Chains.POLYGON, Chains.BNB_CHAIN, Chains.AVALANCHE, Chains.FANTOM, Chains.ARBITRUM, Chains.CRONOS];

export class MoralisPriceSource implements IPriceSource {
  constructor(private readonly fetchService: IFetchService, private readonly apiKey: string) {}

  supportedQueries() {
    const support: PricesQueriesSupport = {
      getCurrentPrices: true,
      getHistoricalPrices: false,
      getBulkHistoricalPrices: false,
      getChart: false,
    };
    const entries = SUPPORTED_CHAINS.map(({ chainId }) => chainId).map((chainId) => [chainId, support]);
    return Object.fromEntries(entries);
  }

  async getCurrentPrices({
    addresses,
    config,
  }: {
    addresses: Record<ChainId, TokenAddress[]>;
    config: { timeout?: TimeString } | undefined;
  }): Promise<Record<ChainId, Record<TokenAddress, PriceResult>>> {
    const result: Record<ChainId, Record<TokenAddress, PriceResult>> = Object.fromEntries(
      Object.keys(addresses).map((chainId) => [Number(chainId), {}])
    );
    const reducedTimeout = reduceTimeout(config?.timeout, '100');
    const promises = Object.entries(addresses)
      .flatMap(([chainId, addresses]) => addresses.map((address) => ({ chainId: Number(chainId), address })))
      .map(async ({ chainId, address }) => {
        const price = await this.fetchPrice(Number(chainId), address, { timeout: reducedTimeout });
        if (price) {
          result[chainId][address] = price;
        }
      });
    await Promise.allSettled(promises);
    return result;
  }

  getHistoricalPrices(_: {
    addresses: Record<ChainId, TokenAddress[]>;
    timestamp: Timestamp;
    searchWidth: TimeString | undefined;
    config: { timeout?: TimeString } | undefined;
  }): Promise<Record<ChainId, Record<TokenAddress, PriceResult>>> {
    return Promise.reject(new Error('Operation not supported'));
  }

  getBulkHistoricalPrices(_: {
    addresses: Record<ChainId, { token: TokenAddress; timestamp: Timestamp }[]>;
    searchWidth: TimeString | undefined;
    config: { timeout?: TimeString } | undefined;
  }): Promise<Record<ChainId, Record<TokenAddress, Record<Timestamp, PriceResult>>>> {
    return Promise.reject(new Error('Operation not supported'));
  }

  async getChart(_: {
    tokens: Record<ChainId, TokenAddress[]>;
    span: number;
    period: TimeString;
    bound: { from: Timestamp } | { upTo: Timestamp | 'now' };
    searchWidth?: TimeString;
    config: { timeout?: TimeString } | undefined;
  }): Promise<Record<ChainId, Record<TokenAddress, PriceResult[]>>> {
    return Promise.reject(new Error('Operation not supported'));
  }

  private async fetchPrice(chainId: ChainId, address: Address, config?: { timeout?: TimeString }): Promise<PriceResult | undefined> {
    const addressToFetch = isSameAddress(address, Addresses.NATIVE_TOKEN) ? getChainByKey(chainId)?.wToken : address;
    if (!addressToFetch) return undefined;
    const body = await this.fetch(
      `https://deep-index.moralis.io/api/v2/erc20/${addressToFetch.toLowerCase()}/price?chain=${chainIdToValidChain(chainId)}`,
      config?.timeout
    );
    return { price: body.usdPrice, closestTimestamp: nowInSeconds() };
  }

  private async fetch(url: string, timeout?: TimeString): Promise<any> {
    const response = await this.fetchService.fetch(url, {
      headers: { 'X-API-Key': this.apiKey },
      timeout,
    });
    return response.json();
  }
}

function chainIdToValidChain(chainId: ChainId) {
  return toTrimmedHex(chainId);
}
