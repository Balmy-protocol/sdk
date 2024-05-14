import { ChainId, TimeString, Timestamp, TokenAddress } from '@types';
import { CacheConfig, ConcurrentLRUCacheWithContext } from '@shared/concurrent-lru-cache';
import { PriceResult, IPriceSource, PriceInput } from '../types';
import { toTokenInChain, fromTokenInChain, TokenInChain } from '@shared/utils';

type CacheContext = { timeout?: TimeString } | undefined;
export class CachedPriceSource implements IPriceSource {
  private readonly cache: ConcurrentLRUCacheWithContext<CacheContext, TokenInChain, PriceResult>;

  constructor(private readonly source: IPriceSource, config: CacheConfig) {
    this.cache = new ConcurrentLRUCacheWithContext<CacheContext, TokenInChain, PriceResult>({
      calculate: (context, tokensInChain) => this.fetchTokens(tokensInChain, context),
      config,
    });
  }

  supportedQueries() {
    return this.source.supportedQueries();
  }

  async getCurrentPrices({
    tokens,
    config,
  }: {
    tokens: PriceInput[];
    config?: { timeout?: TimeString };
  }): Promise<Record<ChainId, Record<TokenAddress, PriceResult>>> {
    const tokensInChain = addressesToTokensInChain(tokens);
    const cacheResult = await this.cache.getOrCalculate({ keys: tokensInChain, context: config, timeout: config?.timeout });
    return tokenInChainRecordToChainAndAddress(cacheResult);
  }

  getHistoricalPrices({
    tokens,
    timestamp,
    searchWidth,
    config,
  }: {
    tokens: PriceInput[];
    timestamp: Timestamp;
    searchWidth?: TimeString;
    config?: { timeout?: TimeString };
  }): Promise<Record<ChainId, Record<TokenAddress, PriceResult>>> {
    // TODO: Support caching, but make it configurable
    return this.source.getHistoricalPrices({ tokens, timestamp, searchWidth, config });
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
    // TODO: Support caching, but make it configurable
    return this.source.getBulkHistoricalPrices({ tokens, searchWidth, config });
  }

  async getChart({
    tokens,
    span,
    period,
    bound,
    searchWidth,
    config,
  }: {
    tokens: PriceInput[];
    span: number;
    period: TimeString;
    bound: { from: Timestamp } | { upTo: Timestamp | 'now' };
    searchWidth?: TimeString;
    config: { timeout?: TimeString } | undefined;
  }): Promise<Record<ChainId, Record<TokenAddress, PriceResult[]>>> {
    // TODO: Support caching, but make it configurable
    return this.source.getChart({
      tokens,
      span,
      period,
      bound,
      searchWidth,
      config,
    });
  }

  private async fetchTokens(tokensInChain: TokenInChain[], context?: CacheContext): Promise<Record<TokenInChain, PriceResult>> {
    const addresses = tokensInChainToAddresses(tokensInChain);
    const tokens = await this.source.getCurrentPrices({ tokens: addresses, config: { timeout: context?.timeout } });
    return chainAndAddressRecordToTokenInChain(tokens);
  }
}

function addressesToTokensInChain(tokens: PriceInput[]): TokenInChain[] {
  return tokens.map(({ chainId, token }) => toTokenInChain(chainId, token));
}

function tokensInChainToAddresses(tokensInChain: TokenInChain[]): PriceInput[] {
  return tokensInChain.map((tokenInChain) => {
    const { chainId, address } = fromTokenInChain(tokenInChain);
    return { chainId, token: address };
  });
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
