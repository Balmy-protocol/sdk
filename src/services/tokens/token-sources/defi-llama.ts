import { ChainId, TokenAddress } from '@types';
import { Addresses } from '@shared/constants';
import { Chains } from '@chains';
import { IFetchService } from '@services/fetch/types';
import { AddedProperties, BaseToken, ITokenSource } from '../types';
import { isSameAddress } from '@shared/utils';

const CHAIN_ID_TO_KEY: Record<ChainId, string> = {
  [Chains.ETHEREUM.chainId]: 'ethereum',
  [Chains.BNB_CHAIN.chainId]: 'bsc',
  [Chains.POLYGON.chainId]: 'polygon',
  [Chains.AVALANCHE.chainId]: 'avax',
  [Chains.FANTOM.chainId]: 'fantom',
  [Chains.GNOSIS.chainId]: 'xdai',
  [Chains.HECO.chainId]: 'heco',
  [Chains.ARBITRUM.chainId]: 'arbitrum',
  [Chains.OPTIMISM.chainId]: 'optimism',
  [Chains.CELO.chainId]: 'celo',
  [Chains.CRONOS.chainId]: 'cronos',
  [Chains.BOBA.chainId]: 'boba',
  [Chains.MOONRIVER.chainId]: 'moonriver',
  [Chains.OKC.chainId]: 'okexchain',
  [Chains.ONTOLOGY.chainId]: 'ontology',
  [Chains.KLAYTN.chainId]: 'klaytn',
  [Chains.AURORA.chainId]: 'aurora',

  // TODO: these chains are also supported by DefiLlama. We should add them
  // "harmony",
  // "kcc",
  // "kava",
  // "rsk",
  // "wan",
  // "kardia",
  // "metis",
  // "telos",
  // "moonbeam",
  // "meter",
  // "sx",
  // "velas",
  // "milkomeda"
};

const KEY_TO_CHAIN_ID: Record<string, ChainId> = Object.fromEntries(
  Object.entries(CHAIN_ID_TO_KEY).map(([chainId, key]) => [key, parseInt(chainId)])
)

export type DefiLlamaToken = FetchTokenResult & BaseToken;
export class DefiLlamaTokenSource implements ITokenSource<DefiLlamaToken> {
  constructor(private readonly fetch: IFetchService) { }

  supportedChains(): ChainId[] {
    return Object.keys(CHAIN_ID_TO_KEY)
      .map((chainId) => parseInt(chainId))
  }

  async getTokens(addresses: Record<ChainId, TokenAddress[]>): Promise<Record<ChainId, Record<TokenAddress, DefiLlamaToken>>> {
    const tokenIds = Object.entries(addresses).flatMap(([chainId, addresses]) =>
      addresses.map((address) => toTokenId(parseInt(chainId), address))
    );
    const coins = await this.fetchTokens(tokenIds);
    const result: Record<ChainId, Record<TokenAddress, DefiLlamaToken>> = Object.fromEntries(
      Object.keys(addresses).map((chainId) => [chainId, {}])
    );
    for (const [tokenId, token] of Object.entries(coins)) {
      const { chainId, address } = fromTokenId(tokenId);
      result[chainId][address] = { ...token, address };
    }
    return result;
  }

  addedProperties(): AddedProperties<DefiLlamaToken>[] {
    return ['price', 'timestamp'];
  }

  private async fetchTokens(tokens: TokenId[]) {
    const chunkSize = 30;
    const chunks = [...Array(Math.ceil(tokens.length / chunkSize))].map((_) => tokens.splice(0, chunkSize));
    const requests = chunks.map(async (chunk) => {
      const url = 'https://coins.llama.fi/prices/current/' + chunk.join(',');
      const response = await this.fetch.fetch(url);
      if (!response.ok) {
        throw new Error('Request to Defi Llama API failed');
      }
      const { coins }: { coins: Record<TokenId, FetchTokenResult> } = await response.json();
      return coins;
    });
    const responses = await Promise.all(requests);
    return responses.reduce((accum, curr) => ({ ...accum, ...curr }), {});
  }
}

const DEFI_LLAMA_NATIVE_TOKEN = '0x0000000000000000000000000000000000000000';

function toTokenId(chainId: ChainId, address: TokenAddress) {
  const key = CHAIN_ID_TO_KEY[chainId];
  return isSameAddress(address, Addresses.NATIVE_TOKEN) ? `${key}:${DEFI_LLAMA_NATIVE_TOKEN}` : `${key}:${address}`;
}

function fromTokenId(tokenId: TokenId): { chainId: ChainId; address: TokenAddress } {
  const [key, address] = tokenId.split(':');
  return {
    chainId: KEY_TO_CHAIN_ID[key],
    address: address.replaceAll(DEFI_LLAMA_NATIVE_TOKEN, Addresses.NATIVE_TOKEN),
  };
}

type FetchTokenResult = {
  decimals: number;
  price: number;
  symbol: string;
  timestamp: number;
};
type TokenId = string;
