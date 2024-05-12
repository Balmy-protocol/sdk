import { ChainId, TimeString, Timestamp, TokenAddress } from '@types';

export type TokenPrice = number;

export type IPriceService = {
  supportedChains(): ChainId[];
  supportedQueries(): Record<ChainId, PricesQueriesSupport>;
  getCurrentPricesInChain(_: {
    chainId: ChainId;
    tokens: TokenAddress[];
    config?: { timeout?: TimeString };
  }): Promise<Record<TokenAddress, PriceResult>>;
  getCurrentPrices(_: { tokens: PriceInput[]; config?: { timeout?: TimeString } }): Promise<Record<ChainId, Record<TokenAddress, PriceResult>>>;
  getHistoricalPricesInChain(_: {
    chainId: ChainId;
    tokens: TokenAddress[];
    timestamp: Timestamp;
    searchWidth?: TimeString;
    config?: { timeout?: TimeString };
  }): Promise<Record<TokenAddress, PriceResult>>;
  getHistoricalPrices(_: {
    tokens: PriceInput[];
    timestamp: Timestamp;
    searchWidth?: TimeString;
    config?: { timeout?: TimeString };
  }): Promise<Record<ChainId, Record<TokenAddress, PriceResult>>>;
  getBulkHistoricalPrices(_: {
    tokens: { chainId: ChainId; token: TokenAddress; timestamp: Timestamp }[];
    searchWidth?: TimeString;
    config?: { timeout?: TimeString };
  }): Promise<Record<ChainId, Record<TokenAddress, Record<Timestamp, PriceResult>>>>;
  getChart(_: {
    tokens: PriceInput[];
    span: number;
    period: TimeString;
    bound: { from: Timestamp } | { upTo: Timestamp | 'now' };
    searchWidth?: TimeString;
  }): Promise<Record<ChainId, Record<TokenAddress, PriceResult[]>>>;
};

export type PricesQueriesSupport = {
  getBulkHistoricalPrices: boolean;
  getHistoricalPrices: boolean;
  getCurrentPrices: true;
  getChart: boolean;
};

export type PriceResult = { price: TokenPrice; closestTimestamp: Timestamp };

export type IPriceSource = {
  supportedQueries(): Record<ChainId, PricesQueriesSupport>;
  getCurrentPrices(_: {
    tokens: PriceInput[];
    config: { timeout?: TimeString } | undefined;
  }): Promise<Record<ChainId, Record<TokenAddress, PriceResult>>>;
  getHistoricalPrices(_: {
    tokens: PriceInput[];
    timestamp: Timestamp;
    searchWidth: TimeString | undefined;
    config: { timeout?: TimeString } | undefined;
  }): Promise<Record<ChainId, Record<TokenAddress, PriceResult>>>;
  getBulkHistoricalPrices(_: {
    tokens: { chainId: ChainId; token: TokenAddress; timestamp: Timestamp }[];
    searchWidth: TimeString | undefined;
    config: { timeout?: TimeString } | undefined;
  }): Promise<Record<ChainId, Record<TokenAddress, Record<Timestamp, PriceResult>>>>;
  getChart(_: {
    tokens: PriceInput[];
    span: number;
    period: TimeString;
    bound: { from: Timestamp } | { upTo: Timestamp | 'now' };
    searchWidth?: TimeString;
    config: { timeout?: TimeString } | undefined;
  }): Promise<Record<ChainId, Record<TokenAddress, PriceResult[]>>>;
};

export type PriceInput = {
  chainId: ChainId;
  token: TokenAddress;
};
