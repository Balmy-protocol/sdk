import { ChainId, TimeString, TokenAddress } from '@types';
import { Cache, ExpirationConfigOptions } from '@shared/generic-cache';
import { HistoricalPriceResult, IPriceSource, Timestamp, TokenPrice } from '../types';
import { toTokenInChain, fromTokenInChain, TokenInChain } from '@shared/utils';

type CacheContext = { timeout?: TimeString } | undefined;
export class CachedPriceSource implements IPriceSource {
  private readonly cache: Cache<CacheContext, TokenInChain, TokenPrice>;

  constructor(private readonly source: IPriceSource, expirationConfig: ExpirationConfigOptions) {
    this.cache = new Cache<CacheContext, TokenInChain, TokenPrice>({
      calculate: (context, tokensInChain) => this.fetchTokens(tokensInChain, context),
      expirationConfig,
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
  }): Promise<Record<ChainId, Record<TokenAddress, TokenPrice>>> {
    const tokensInChain = addressesToTokensInChain(addresses);
    const tokens = await this.cache.getOrCalculate({ keys: tokensInChain, context: config, timeout: config?.timeout });
    return tokenInChainRecordToChainAndAddress(tokens);
  }

  getHistoricalPrices(_: {
    addresses: Record<ChainId, TokenAddress[]>;
    timestamp: Timestamp;
    searchWidth?: TimeString;
    config?: { timeout?: TimeString };
  }): Promise<Record<ChainId, Record<TokenAddress, HistoricalPriceResult>>> {}

  private async fetchTokens(tokensInChain: TokenInChain[], context?: CacheContext): Promise<Record<TokenInChain, TokenPrice>> {
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

function tokenInChainRecordToChainAndAddress(record: Record<TokenInChain, TokenPrice>): Record<ChainId, Record<TokenAddress, TokenPrice>> {
  const result: Record<ChainId, Record<TokenAddress, TokenPrice>> = {};
  for (const [tokenInChain, token] of Object.entries(record)) {
    const { chainId, address } = fromTokenInChain(tokenInChain);
    if (!(chainId in result)) {
      result[chainId] = {};
    }
    result[chainId][address] = token;
  }
  return result;
}

function chainAndAddressRecordToTokenInChain(record: Record<ChainId, Record<TokenAddress, TokenPrice>>): Record<TokenInChain, TokenPrice> {
  const entries = Object.entries(record).flatMap(([chainId, record]) =>
    Object.entries(record).map<[TokenInChain, TokenPrice]>(([address, token]) => [toTokenInChain(parseInt(chainId), address), token])
  );
  return Object.fromEntries(entries);
}
