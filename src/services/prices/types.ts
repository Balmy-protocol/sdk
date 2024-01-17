import { ChainId, TimeString, Timestamp, TokenAddress } from '@types';

export type TokenPrice = number;

export type IPriceService = {
  supportedChains(): ChainId[];
  supportedQueries(): Record<ChainId, PricesQueriesSupport>;
  getCurrentPricesForChain(_: {
    chainId: ChainId;
    addresses: TokenAddress[];
    config?: { timeout?: TimeString };
  }): Promise<Record<TokenAddress, PriceResult>>;
  getCurrentPrices(_: {
    addresses: Record<ChainId, TokenAddress[]>;
    config?: { timeout?: TimeString };
  }): Promise<Record<ChainId, Record<TokenAddress, PriceResult>>>;
  getHistoricalPricesForChain(_: {
    chainId: ChainId;
    addresses: TokenAddress[];
    timestamp: Timestamp;
    searchWidth?: TimeString;
    config?: { timeout?: TimeString };
  }): Promise<Record<TokenAddress, PriceResult>>;
  getHistoricalPrices(_: {
    addresses: Record<ChainId, TokenAddress[]>;
    timestamp: Timestamp;
    searchWidth?: TimeString;
    config?: { timeout?: TimeString };
  }): Promise<Record<ChainId, Record<TokenAddress, PriceResult>>>;
  getBulkHistoricalPrices(_: {
    addresses: { chainId: ChainId; token: TokenAddress; timestamp: Timestamp }[];
    searchWidth?: TimeString;
    config?: { timeout?: TimeString };
  }): Promise<Record<ChainId, Record<TokenAddress, Record<Timestamp, PriceResult>>>>;
};

export type PricesQueriesSupport = {
  getBulkHistoricalPrices: boolean;
  getHistoricalPrices: boolean;
  getCurrentPrices: true;
};

export type PriceResult = { price: TokenPrice; closestTimestamp: Timestamp };

export type IPriceSource = {
  supportedQueries(): Record<ChainId, PricesQueriesSupport>;
  getCurrentPrices(_: {
    addresses: Record<ChainId, TokenAddress[]>;
    config: { timeout?: TimeString } | undefined;
  }): Promise<Record<ChainId, Record<TokenAddress, PriceResult>>>;
  getHistoricalPrices(_: {
    addresses: Record<ChainId, TokenAddress[]>;
    timestamp: Timestamp;
    searchWidth: TimeString | undefined;
    config: { timeout?: TimeString } | undefined;
  }): Promise<Record<ChainId, Record<TokenAddress, PriceResult>>>;
  getBulkHistoricalPrices(_: {
    addresses: Record<ChainId, { token: TokenAddress; timestamp: Timestamp }[]>;
    searchWidth: TimeString | undefined;
    config: { timeout?: TimeString } | undefined;
  }): Promise<Record<ChainId, Record<TokenAddress, Record<Timestamp, PriceResult>>>>;
};
