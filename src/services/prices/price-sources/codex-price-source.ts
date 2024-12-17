import { ChainId, TimeString, Timestamp, TokenAddress } from '@types';
import { IFetchService } from '@services/fetch/types';
import { PriceResult, IPriceSource, PricesQueriesSupport, PriceInput } from '../types';
import { Chains, getChainByKeyOrFail } from '@chains';
import { isSameAddress, splitInChunks } from '@shared/utils';
import { Addresses } from '@shared/constants';
import ms from 'ms';

const SUPPORTED_CHAINS = [
  Chains.ARBITRUM,
  Chains.ASTAR,
  Chains.AURORA,
  Chains.AVALANCHE,
  Chains.BASE,
  Chains.BLAST,
  Chains.BNB_CHAIN,
  Chains.BOBA,
  Chains.CANTO,
  // Chains.CELO, // wrapped native not supported
  Chains.CRONOS,
  Chains.ETHEREUM,
  Chains.EVMOS,
  Chains.FANTOM,
  Chains.FUSE,
  Chains.GNOSIS,
  Chains.HARMONY_SHARD_0,
  Chains.HECO,
  Chains.KAIA,
  Chains.LINEA,
  Chains.MANTLE,
  Chains.METIS_ANDROMEDA,
  Chains.MODE,
  Chains.MOONBEAM,
  Chains.MOONRIVER,
  Chains.OKC,
  Chains.OPTIMISM,
  Chains.POLYGON,
  Chains.POLYGON_ZKEVM,
  Chains.SCROLL,
  Chains.VELAS,
];

export class CodexPriceSource implements IPriceSource {
  constructor(private readonly fetch: IFetchService, private readonly apiKey: string) {}

  supportedQueries() {
    const support: PricesQueriesSupport = {
      getCurrentPrices: true,
      getHistoricalPrices: true,
      getBulkHistoricalPrices: true,
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
    const input = tokens.map(({ token, chainId }) => ({ chainId, token }));
    const prices = await this.getBulkPrices({ tokens: input, config });
    return Object.fromEntries(
      Object.entries(prices).map(([chainId, tokens]) => [
        chainId,
        Object.fromEntries(Object.entries(tokens).map(([token, price]) => [token, Object.values(price).at(0)!])),
      ])
    );
  }

  async getHistoricalPrices({
    tokens,
    timestamp,
    searchWidth,
    config,
  }: {
    tokens: PriceInput[];
    timestamp: Timestamp;
    searchWidth: TimeString | undefined;
    config: { timeout?: TimeString } | undefined;
  }): Promise<Record<ChainId, Record<TokenAddress, PriceResult>>> {
    const input = tokens.map(({ token, chainId }) => ({ chainId, token, timestamp }));
    const prices = await this.getBulkHistoricalPrices({ tokens: input, searchWidth, config });
    return Object.fromEntries(
      Object.entries(prices).map(([chainId, tokens]) => [
        chainId,
        Object.fromEntries(Object.entries(tokens).map(([token, price]) => [token, price[timestamp]])),
      ])
    );
  }

  getBulkHistoricalPrices({
    tokens,
    searchWidth,
    config,
  }: {
    tokens: { chainId: ChainId; token: TokenAddress; timestamp: Timestamp }[];
    searchWidth: TimeString | undefined;
    config: { timeout?: TimeString } | undefined;
  }): Promise<Record<ChainId, Record<TokenAddress, Record<Timestamp, PriceResult>>>> {
    return this.getBulkPrices({ tokens, searchWidth, config });
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

  private async getBulkPrices({
    tokens,
    searchWidth,
    config,
  }: {
    tokens: { chainId: ChainId; token: TokenAddress; timestamp?: Timestamp }[];
    searchWidth?: TimeString;
    config: { timeout?: TimeString } | undefined;
  }): Promise<Record<ChainId, Record<TokenAddress, Record<Timestamp, PriceResult>>>> {
    const result: Record<ChainId, Record<TokenAddress, Record<Timestamp, PriceResult>>> = {};
    if (!this.apiKey) {
      return result;
    }
    const chunks = splitInChunks(tokens, 25);
    const requests = chunks.map(async (chunk) => {
      const query = {
        query: `query {
                getTokenPrices(
                  inputs: [
                    ${chunk
                      .map(
                        ({ token, chainId, timestamp }) =>
                          `{ address: "${
                            // Codex doesn't support native tokens, so we use the wrapped native token
                            isSameAddress(token, Addresses.NATIVE_TOKEN) ? getChainByKeyOrFail(chainId).wToken : token
                          }", networkId: ${chainId} ${timestamp ? `, timestamp: ${timestamp}` : ''}  }`
                      )
                      .join('\n')}
                  ]
                ) {
                  networkId
                  address
                  priceUsd
                  timestamp
                }
              }`,
      };
      const response = await this.fetch.fetch(`https://graph.defined.fi/graphql`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: this.apiKey },
        body: JSON.stringify(query),
        timeout: config?.timeout,
      });

      if (!response.ok) {
        return;
      }

      const body: Response = await response.json();
      chunk.forEach(({ chainId, token, timestamp }, index) => {
        const tokenPrice = body.data.getTokenPrices[index];
        if (!tokenPrice) return;
        if (searchWidth && timestamp && Math.abs(tokenPrice.timestamp - timestamp) > ms(searchWidth)) return;
        if (!result[chainId]) result[chainId] = {};
        if (!result[chainId][token]) result[chainId][token] = {};
        result[chainId][token][timestamp ?? tokenPrice.timestamp] = { price: tokenPrice.priceUsd, closestTimestamp: tokenPrice.timestamp };
      });
    });

    await Promise.all(requests);
    return result;
  }
}

type Response = { data: { getTokenPrices: { networkId: ChainId; address: TokenAddress; priceUsd: number; timestamp: number }[] } };
