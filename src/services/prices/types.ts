import { ChainId, TimeString, TokenAddress } from '@types';

export type TokenPrice = number;

export type IPriceService = {
  supportedChains(): ChainId[];
  getCurrentPricesForChain(_: {
    chainId: ChainId;
    addresses: TokenAddress[];
    config?: { timeout?: TimeString };
  }): Promise<Record<TokenAddress, TokenPrice>>;
  getCurrentPrices(_: {
    addresses: Record<ChainId, TokenAddress[]>;
    config?: { timeout?: TimeString };
  }): Promise<Record<ChainId, Record<TokenAddress, TokenPrice>>>;
};

export type IPriceSource = {
  getCurrentPrices(_: {
    addresses: Record<ChainId, TokenAddress[]>;
    config?: { timeout?: TimeString };
  }): Promise<Record<ChainId, Record<TokenAddress, TokenPrice>>>;
  supportedChains(): ChainId[];
};
