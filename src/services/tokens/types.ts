import { ChainId, Network, TokenAddress } from '@types';
import { DefiLlamaToken } from './token-sources/defi-llama';

export type ITokenService<Token extends BaseToken> = {
  supportedNetworks(): Network[];
  getTokensForNetwork(network: Network, addresses: TokenAddress[]): Promise<Record<TokenAddress, Token>>;
  getTokens(...addresses: { network: Network; addresses: TokenAddress[] }[]): Promise<Record<ChainId, Record<TokenAddress, Token>>>;
  getTokensByChainId(addresses: Record<ChainId, TokenAddress[]>): Promise<Record<ChainId, Record<TokenAddress, Token>>>;
};

export type ITokenSource<Token extends BaseToken = BaseToken> = {
  supportedNetworks(): Network[];
  getTokens(addresses: Record<ChainId, TokenAddress[]>): Promise<Record<ChainId, Record<TokenAddress, Token>>>;
  addedProperties(): AddedProperties<Token>[];
};

export type AddedProperties<Token extends BaseToken = BaseToken> = Exclude<keyof Token, keyof BaseToken>;

export type BaseToken = {
  address: TokenAddress;
  decimals: number;
  symbol: string;
};
