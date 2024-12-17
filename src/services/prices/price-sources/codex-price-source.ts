import { ChainId, TimeString, Timestamp, TokenAddress } from '@types';
import { IFetchService } from '@services/fetch/types';
import { PriceResult, IPriceSource, PricesQueriesSupport, PriceInput } from '../types';
import { Chains, getChainByKeyOrFail } from '@chains';
import { isSameAddress, splitInChunks } from '@shared/utils';
import { Addresses } from '@shared/constants';

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
    const result: Record<ChainId, Record<TokenAddress, PriceResult>> = {};
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
                        ({ token, chainId }) =>
                          `{ address: "${
                            // Codex doesn't support native tokens, so we use the wrapped native token
                            isSameAddress(token, Addresses.NATIVE_TOKEN) ? getChainByKeyOrFail(chainId).wToken : token
                          }", networkId: ${chainId} }`
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
      for (const tokenPrice of body.data.getTokenPrices) {
        if (!tokenPrice) continue;
        if (!result[tokenPrice.networkId]) {
          result[tokenPrice.networkId] = {};
        }
        let address = chunk.find(({ token, chainId }) => isSameAddress(token, tokenPrice.address) && chainId === tokenPrice.networkId)!;
        if (!address && isSameAddress(tokenPrice.address, getChainByKeyOrFail(tokenPrice.networkId).wToken)) {
          address = { token: Addresses.NATIVE_TOKEN, chainId: tokenPrice.networkId };
        }
        result[address.chainId][address.token] = { price: tokenPrice.priceUsd, closestTimestamp: tokenPrice.timestamp };
      }
    });

    await Promise.all(requests);
    return result;
  }

  getHistoricalPrices(_: {
    tokens: PriceInput[];
    timestamp: Timestamp;
    searchWidth: TimeString | undefined;
    config: { timeout?: TimeString } | undefined;
  }): Promise<Record<ChainId, Record<TokenAddress, PriceResult>>> {
    // Only last 3 days supported
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
}

type Response = { data: { getTokenPrices: { networkId: ChainId; address: TokenAddress; priceUsd: number; timestamp: number }[] } };
