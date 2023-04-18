import { ChainId, TimeString, Timestamp, TokenAddress } from '@types';

export type TokenPrice = number;

export type IPriceService = {
  supportedChains(): ChainId[];
  supportedQueries(): Record<ChainId, PricesQueriesSupport>;
  getCurrentPricesForChain(_: {
    chainId: ChainId;
    addresses: TokenAddress[];
    config?: { timeout?: TimeString };
  }): Promise<Record<TokenAddress, TokenPrice>>;
  getCurrentPrices(_: {
    addresses: Record<ChainId, TokenAddress[]>;
    config?: { timeout?: TimeString };
  }): Promise<Record<ChainId, Record<TokenAddress, TokenPrice>>>;
  getHistoricalPricesForChain(_: {
    chainId: ChainId;
    addresses: TokenAddress[];
    timestamp: Timestamp;
    searchWidth?: TimeString;
    config?: { timeout?: TimeString };
  }): Promise<Record<TokenAddress, HistoricalPriceResult>>;
  getHistoricalPrices(_: {
    addresses: Record<ChainId, TokenAddress[]>;
    timestamp: Timestamp;
    searchWidth?: TimeString;
    config?: { timeout?: TimeString };
  }): Promise<Record<ChainId, Record<TokenAddress, HistoricalPriceResult>>>;
};

export type PricesQueriesSupport = {
  getHistoricalPrices: boolean;
  getCurrentPrices: true;
};

export type HistoricalPriceResult = { price: TokenPrice; timestamp: Timestamp };

export type IPriceSource = {
  supportedQueries(): Record<ChainId, PricesQueriesSupport>;
  getCurrentPrices(_: {
    addresses: Record<ChainId, TokenAddress[]>;
    config?: { timeout?: TimeString };
  }): Promise<Record<ChainId, Record<TokenAddress, TokenPrice>>>;
  getHistoricalPrices(_: {
    addresses: Record<ChainId, TokenAddress[]>;
    timestamp: Timestamp;
    searchWidth?: TimeString;
    config?: { timeout?: TimeString };
  }): Promise<Record<ChainId, Record<TokenAddress, HistoricalPriceResult>>>;
};
