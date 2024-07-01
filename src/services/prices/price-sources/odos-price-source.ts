import { ChainId, TimeString, Timestamp, TokenAddress } from '@types';
import { IFetchService } from '@services/fetch/types';
import { PriceResult, IPriceSource, PricesQueriesSupport, TokenPrice, PriceInput } from '../types';
import { Chains } from '@chains';
import { reduceTimeout, timeoutPromise } from '@shared/timeouts';
import { filterRejectedResults, groupByChain, isSameAddress } from '@shared/utils';
import { Addresses } from '@shared/constants';
import { nowInSeconds } from './utils';

const SUPPORTED_CHAINS = [Chains.ETHEREUM, Chains.POLYGON, Chains.OPTIMISM, Chains.AVALANCHE, Chains.ARBITRUM, Chains.BNB_CHAIN, Chains.BASE];

export class OdosPriceSource implements IPriceSource {
  constructor(private readonly fetch: IFetchService) {}

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
    tokens,
    config,
  }: {
    tokens: PriceInput[];
    config: { timeout?: TimeString } | undefined;
  }): Promise<Record<ChainId, Record<TokenAddress, PriceResult>>> {
    const groupedByChain = groupByChain(tokens, ({ token }) => token);
    const reducedTimeout = reduceTimeout(config?.timeout, '100');
    const promises = Object.entries(groupedByChain).map(async ([chainId, tokens]) => [
      Number(chainId),
      await timeoutPromise(this.getCurrentPricesInChain(chainId, tokens, reducedTimeout), reducedTimeout),
    ]);
    return Object.fromEntries(await filterRejectedResults(promises));
  }

  getHistoricalPrices(_: {
    tokens: PriceInput[];
    timestamp: Timestamp;
    searchWidth: TimeString | undefined;
    config: { timeout?: TimeString } | undefined;
  }): Promise<Record<ChainId, Record<TokenAddress, PriceResult>>> {
    return Promise.reject(new Error('Operation not supported'));
  }

  getBulkHistoricalPrices(_: {
    tokens: { chainId: ChainId; token: TokenAddress; timestamp: Timestamp }[];
    searchWidth: TimeString | undefined;
    config: { timeout?: TimeString } | undefined;
  }): Promise<Record<ChainId, Record<TokenAddress, Record<Timestamp, PriceResult>>>> {
    return Promise.reject(new Error('Operation not supported'));
  }

  async getChart(_: {
    tokens: PriceInput[];
    span: number;
    period: TimeString;
    bound: { from: Timestamp } | { upTo: Timestamp | 'now' };
    searchWidth?: TimeString;
    config: { timeout?: TimeString } | undefined;
  }): Promise<Record<ChainId, Record<TokenAddress, PriceResult[]>>> {
    return Promise.reject(new Error('Operation not supported'));
  }

  private async getCurrentPricesInChain(chainId: string, addresses: TokenAddress[], timeout?: TimeString) {
    const params = addresses.map((address) => `token_addresses=${mapToken(address)}`).join('&');
    const url = `https://api.odos.xyz/pricing/token/${chainId}?${params}`;
    const response = await this.fetch.fetch(url, { timeout });
    const body: Response = await response.json();
    const lowercased = toLowerCase(body.tokenPrices);
    return Object.fromEntries(
      addresses.map((address) => [address, { price: lowercased[mapToken(address.toLowerCase())], closestTimestamp: nowInSeconds() }])
    );
  }
}

function mapToken(address: TokenAddress) {
  return isSameAddress(address, Addresses.NATIVE_TOKEN) ? Addresses.ZERO_ADDRESS : address;
}

function toLowerCase(prices: Record<TokenAddress, TokenPrice>) {
  return Object.fromEntries(Object.entries(prices).map(([token, price]) => [token.toLowerCase(), price]));
}

type Response = { tokenPrices: Record<TokenAddress, TokenPrice> };
