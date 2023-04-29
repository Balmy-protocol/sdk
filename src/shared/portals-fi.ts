import { Chains } from '@chains';
import { IFetchService } from '@services/fetch';
import { Addresses } from '@shared/constants';
import { isSameAddress } from '@shared/utils';
import { ChainId, TokenAddress, TimeString } from '@types';

export const PORTALS_FI_CHAIN_ID_TO_KEY: Record<ChainId, string> = {
  [Chains.ETHEREUM.chainId]: 'ethereum',
  [Chains.OPTIMISM.chainId]: 'optimism',
  [Chains.FANTOM.chainId]: 'fantom',
  [Chains.ARBITRUM.chainId]: 'arbitrum',
  [Chains.POLYGON.chainId]: 'polygon',
  [Chains.AVALANCHE.chainId]: 'avalanche',
  [Chains.BNB_CHAIN.chainId]: 'bsc',
};

export const PORTALS_FI_KEY_TO_CHAIN_ID: Record<string, ChainId> = Object.fromEntries(
  Object.entries(PORTALS_FI_CHAIN_ID_TO_KEY).map(([chainId, key]) => [key, Number(chainId)])
);

export const PORTALS_FI_SUPPORTED_CHAINS: ChainId[] = Object.keys(PORTALS_FI_CHAIN_ID_TO_KEY).map(Number);

export class PortalsFiClient {
  constructor(private readonly fetch: IFetchService) {}

  async getData({ addresses, config }: { addresses: Record<ChainId, TokenAddress[]>; config?: { timeout?: TimeString } }) {
    const tokenIds = Object.entries(addresses).flatMap(([chainId, addresses]) =>
      addresses.map((address) => toTokenId(Number(chainId), address))
    );
    const data = await this.fetchData(tokenIds, config);
    const result: Record<ChainId, Record<TokenAddress, FetchTokenResult>> = Object.fromEntries(
      Object.keys(addresses).map((chainId) => [chainId, {}])
    );
    for (const chainIdString in addresses) {
      const chainId = Number(chainIdString);
      for (const address of addresses[chainId]) {
        const tokenId = toTokenId(chainId, address);
        if (tokenId in data) {
          result[chainId][address] = data[tokenId];
        }
      }
    }
    return result;
  }

  supportedChains(): ChainId[] {
    return Object.keys(PORTALS_FI_CHAIN_ID_TO_KEY).map(Number);
  }

  private async fetchData(tokens: TokenId[], config?: { timeout?: TimeString }) {
    const chunkSize = 50;
    const chunks = [...Array(Math.ceil(tokens.length / chunkSize))].map((_) => tokens.splice(0, chunkSize));
    const requests = chunks.map(async (chunk) => {
      const params = chunk.map((tokenId) => `addresses=${tokenId}`).join('&');
      const url = `https://api.portals.fi/v2/tokens?${params}`;
      const response = await this.fetch.fetch(url, { timeout: config?.timeout });
      if (!response.ok) {
        throw new Error('Request to Portals Fi API failed: ' + (await response.text()));
      }
      const result: Result = await response.json();
      return Object.fromEntries(result.tokens.map(({ key, name, decimals, symbol, price }) => [key, { name, decimals, symbol, price }]));
    });
    const responses = await Promise.all(requests);
    return responses.reduce((accum, curr) => ({ ...accum, ...curr }), {});
  }
}

const PORTAS_FI_NATIVE_TOKEN = '0x0000000000000000000000000000000000000000';
const MAPPINGS: Record<string, string> = {};

function toTokenId(chainId: ChainId, address: TokenAddress) {
  const key = PORTALS_FI_CHAIN_ID_TO_KEY[chainId];
  const mappedNativeToken = isSameAddress(address, Addresses.NATIVE_TOKEN) ? `${key}:${PORTAS_FI_NATIVE_TOKEN}` : `${key}:${address}`;
  return (MAPPINGS[mappedNativeToken] ?? mappedNativeToken).toLowerCase();
}

type FetchTokenResult = {
  name: string;
  decimals: number;
  symbol: string;
  price: number;
};
type Result = {
  tokens: ({ key: TokenId } & FetchTokenResult)[];
};
type TokenId = string;
