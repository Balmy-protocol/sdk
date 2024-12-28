import { ChainId, TimeString, Timestamp, TokenAddress } from '@types';
import { IFetchService } from '@services/fetch/types';
import { PriceResult, IPriceSource, PricesQueriesSupport, TokenPrice, PriceInput } from '../types';
import { Chains, getChainByKeyOrFail } from '@chains';
import { reduceTimeout, timeoutPromise } from '@shared/timeouts';
import { filterRejectedResults, groupByChain, isSameAddress, splitInChunks } from '@shared/utils';
import { Addresses } from '@shared/constants';
import { ALCHEMY_NETWORKS } from '@shared/alchemy';
export class AlchemyPriceSource implements IPriceSource {
  constructor(private readonly fetch: IFetchService, private readonly apiKey: string) {
    if (!this.apiKey) throw new Error('API key is required');
  }

  supportedQueries() {
    const support: PricesQueriesSupport = {
      getCurrentPrices: true,
      getHistoricalPrices: false,
      getBulkHistoricalPrices: false,
      getChart: false,
    };
    const entries = Object.entries(ALCHEMY_NETWORKS)
      .filter(
        ([
          _,
          {
            price: { supported },
          },
        ]) => supported
      )
      .map(([chainId]) => [chainId, support]);
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
      await timeoutPromise(this.getCurrentPricesInChain(Number(chainId), tokens, reducedTimeout), reducedTimeout),
    ]);
    return Object.fromEntries(await filterRejectedResults(promises));
  }

  getHistoricalPrices(_: {
    tokens: PriceInput[];
    timestamp: Timestamp;
    searchWidth: TimeString | undefined;
    config: { timeout?: TimeString } | undefined;
  }): Promise<Record<ChainId, Record<TokenAddress, PriceResult>>> {
    // Only supports historical prices searching by token symbol
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

  private async getCurrentPricesInChain(chainId: ChainId, addresses: TokenAddress[], timeout?: TimeString) {
    const url = `https://api.g.alchemy.com/prices/v1/${this.apiKey}/tokens/by-address`;
    const result: Record<TokenAddress, PriceResult> = {};
    const chunks = splitInChunks(addresses, 25);
    const promises = chunks.map(async (chunk) => {
      const response = await this.fetch.fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          addresses: chunk.map((address) => ({
            network: ALCHEMY_NETWORKS[chainId].key,
            // Alchemy doesn't support native tokens (only on Ethereum), so we use the wrapped native token
            address:
              isSameAddress(address, Addresses.NATIVE_TOKEN) && chainId !== Chains.ETHEREUM.chainId
                ? getChainByKeyOrFail(chainId).wToken
                : address,
          })),
        }),
        timeout,
      });

      if (!response.ok) {
        return;
      }
      const body: Response = await response.json();
      chunk.forEach((address, index) => {
        const tokenPrice = body.data[index].prices[0];
        if (!tokenPrice) return;
        const timestamp = Math.floor(new Date(tokenPrice.lastUpdatedAt).getTime() / 1000);
        result[address] = { price: Number(tokenPrice.value), closestTimestamp: timestamp };
      });
    });

    await Promise.all(promises);
    return result;
  }
}

type Response = { data: { address: TokenAddress; prices: { currency: string; value: string; lastUpdatedAt: string }[] }[] };
