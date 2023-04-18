import { Address, ChainId, TimeString, Timestamp, TokenAddress } from '@types';
import { Chains, getChainByKey } from '@chains';
import { HistoricalPriceResult, IPriceSource, PricesQueriesSupport, TokenPrice } from '../types';
import { IFetchService } from '@services/fetch';
import { utils } from 'ethers';
import { isSameAddress } from '@shared/utils';
import { Addresses } from '@shared/constants';
import { reduceTimeout } from '@shared/timeouts';

const SUPPORTED_CHAINS = [Chains.ETHEREUM, Chains.POLYGON, Chains.BNB_CHAIN, Chains.AVALANCHE, Chains.FANTOM, Chains.ARBITRUM, Chains.CRONOS];

export class MoralisPriceSource implements IPriceSource {
  constructor(private readonly fetchService: IFetchService, private readonly apiKey: string) {}

  supportedQueries() {
    const support: PricesQueriesSupport = { getCurrentPrices: true, getHistoricalPrices: false };
    const entries = SUPPORTED_CHAINS.map(({ chainId }) => chainId).map((chainId) => [chainId, support]);
    return Object.fromEntries(entries);
  }

  async getCurrentPrices({
    addresses,
    config,
  }: {
    addresses: Record<ChainId, TokenAddress[]>;
    config?: { timeout?: TimeString };
  }): Promise<Record<ChainId, Record<TokenAddress, TokenPrice>>> {
    const result: Record<ChainId, Record<TokenAddress, TokenPrice>> = Object.fromEntries(
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
    searchWidth?: TimeString;
    config?: { timeout?: TimeString };
  }): Promise<Record<ChainId, Record<TokenAddress, HistoricalPriceResult>>> {
    return Promise.reject(new Error('Operation not supported'));
  }

  private async fetchPrice(chainId: ChainId, address: Address, config?: { timeout?: TimeString }): Promise<TokenPrice | undefined> {
    const addressToFetch = isSameAddress(address, Addresses.NATIVE_TOKEN) ? getChainByKey(chainId)?.wToken : address;
    if (!addressToFetch) return undefined;
    const body = await this.fetch(
      `https://deep-index.moralis.io/api/v2/erc20/${addressToFetch.toLowerCase()}/price?chain=${chainIdToValidChain(chainId)}`,
      config?.timeout
    );
    return body.usdPrice;
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
  return utils.hexStripZeros(utils.hexlify(chainId));
}
