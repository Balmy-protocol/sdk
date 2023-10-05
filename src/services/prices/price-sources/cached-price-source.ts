import { ChainId, TimeString, Timestamp, TokenAddress } from '@types';
import { CacheConfig, ConcurrentLRUCache } from '@shared/concurrent-lru-cache';
import { PriceResult, IPriceSource } from '../types';
import { toTokenInChain, fromTokenInChain, TokenInChain } from '@shared/utils';

type CacheContext = { timeout?: TimeString } | undefined;
export class CachedPriceSource implements IPriceSource {
  private readonly cache: ConcurrentLRUCache<CacheContext, TokenInChain, PriceResult>;

  constructor(private readonly source: IPriceSource, config: CacheConfig) {
    this.cache = new ConcurrentLRUCache<CacheContext, TokenInChain, PriceResult>({
      calculate: (context, tokensInChain) => this.fetchTokens(tokensInChain, context),
      config,
    });
  }

  supportedQueries() {
    return this.source.supportedQueries();
  }

  async getCurrentPrices({
    addresses,
    config,
  }: {
    addresses: Record<ChainId, TokenAddress[]>;
    config?: { timeout?: TimeString };
  }): Promise<Record<ChainId, Record<TokenAddress, PriceResult>>> {
    const tokensInChain = addressesToTokensInChain(addresses);
    const tokens = await this.cache.getOrCalculate({ keys: tokensInChain, context: config, timeout: config?.timeout });
    return tokenInChainRecordToChainAndAddress(tokens);
  }

  getHistoricalPrices({
    addresses,
    timestamp,
    searchWidth,
    config,
  }: {
    addresses: Record<ChainId, TokenAddress[]>;
    timestamp: Timestamp;
    searchWidth?: TimeString;
    config?: { timeout?: TimeString };
  }): Promise<Record<ChainId, Record<TokenAddress, PriceResult>>> {
    // TODO: Support caching, but make it configurable
    return this.source.getHistoricalPrices({ addresses, timestamp, searchWidth, config });
  }

  getBulkHistoricalPrices({
    addresses,
    searchWidth,
    config,
  }: {
    addresses: Record<ChainId, { token: TokenAddress; timestamp: Timestamp }[]>;
    searchWidth: TimeString | undefined;
    config: { timeout?: TimeString } | undefined;
  }): Promise<Record<ChainId, Record<TokenAddress, Record<Timestamp, PriceResult>>>> {
    // TODO: Support caching, but make it configurable
    return this.source.getBulkHistoricalPrices({ addresses, searchWidth, config });
  }

  private async fetchTokens(tokensInChain: TokenInChain[], context?: CacheContext): Promise<Record<TokenInChain, PriceResult>> {
    const addresses = tokensInChainToAddresses(tokensInChain);
    const tokens = await this.source.getCurrentPrices({ addresses, config: { timeout: context?.timeout } });
    return chainAndAddressRecordToTokenInChain(tokens);
  }
}

function addressesToTokensInChain(addresses: Record<ChainId, TokenAddress[]>): TokenInChain[] {
  return Object.entries(addresses).flatMap(([chainId, addresses]) => addresses.map((address) => toTokenInChain(parseInt(chainId), address)));
}

function tokensInChainToAddresses(tokensInChain: TokenInChain[]): Record<ChainId, TokenAddress[]> {
  const result: Record<ChainId, TokenAddress[]> = {};
  for (const tokenInChain of tokensInChain) {
    const { chainId, address } = fromTokenInChain(tokenInChain);
    if (chainId in result) {
      result[chainId].push(address);
    } else {
      result[chainId] = [address];
    }
  }
  return result;
}

function tokenInChainRecordToChainAndAddress(record: Record<TokenInChain, PriceResult>): Record<ChainId, Record<TokenAddress, PriceResult>> {
  const result: Record<ChainId, Record<TokenAddress, PriceResult>> = {};
  for (const [tokenInChain, token] of Object.entries(record)) {
    const { chainId, address } = fromTokenInChain(tokenInChain);
    if (!(chainId in result)) {
      result[chainId] = {};
    }
    result[chainId][address] = token;
  }
  return result;
}

function chainAndAddressRecordToTokenInChain(record: Record<ChainId, Record<TokenAddress, PriceResult>>): Record<TokenInChain, PriceResult> {
  const entries = Object.entries(record).flatMap(([chainId, record]) =>
    Object.entries(record).map<[TokenInChain, PriceResult]>(([address, token]) => [toTokenInChain(parseInt(chainId), address), token])
  );
  return Object.fromEntries(entries);
}
