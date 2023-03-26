import { ChainId, TimeString, TokenAddress } from '@types';
import { IFetchService } from '@services/fetch/types';
import { IPriceSource, TokenPrice } from '../types';
import { Chains } from '@chains';
import { reduceTimeout, timeoutPromise } from '@shared/timeouts';
import { filterRejectedResults, isSameAddress } from '@shared/utils';
import { Addresses } from '@shared/constants';

const COINGECKO_CHAIN_KEYS: Record<ChainId, { chainKey: string; nativeTokenKey: string }> = {
  [Chains.ONTOLOGY.chainId]: { chainKey: 'ontology', nativeTokenKey: 'ontology' },
  [Chains.BIT_TORRENT.chainId]: { chainKey: 'bittorrent', nativeTokenKey: 'bittorrent' },
  [Chains.BNB_CHAIN.chainId]: { chainKey: 'binance-smart-chain', nativeTokenKey: 'binancecoin' },
  [Chains.HECO.chainId]: { chainKey: 'huobi-token', nativeTokenKey: 'huobi-token' },
  [Chains.KLAYTN.chainId]: { chainKey: 'klay-token', nativeTokenKey: 'klay-token' },
  [Chains.FANTOM.chainId]: { chainKey: 'fantom', nativeTokenKey: 'fantom' },
  [Chains.OPTIMISM.chainId]: { chainKey: 'optimistic-ethereum', nativeTokenKey: 'ethereum' },
  [Chains.POLYGON.chainId]: { chainKey: 'polygon-pos', nativeTokenKey: 'matic-network' },
  [Chains.MOONRIVER.chainId]: { chainKey: 'moonriver', nativeTokenKey: 'moonriver' },
  [Chains.CRONOS.chainId]: { chainKey: 'cronos', nativeTokenKey: 'crypto-com-chain' },
  [Chains.AURORA.chainId]: { chainKey: 'aurora', nativeTokenKey: 'aurora' },
  [Chains.AVALANCHE.chainId]: { chainKey: 'avalanche', nativeTokenKey: 'avalanche-2' },
  [Chains.ETHEREUM.chainId]: { chainKey: 'ethereum', nativeTokenKey: 'ethereum' },
  [Chains.HARMONY_SHARD_0.chainId]: { chainKey: 'harmony-shard-0', nativeTokenKey: 'harmony' },
  [Chains.EVMOS.chainId]: { chainKey: 'evmos', nativeTokenKey: 'evmos' },
  [Chains.BOBA.chainId]: { chainKey: 'boba', nativeTokenKey: 'boba-network' },
  [Chains.CELO.chainId]: { chainKey: 'celo', nativeTokenKey: 'celo' },
  [Chains.ASTAR.chainId]: { chainKey: 'astar', nativeTokenKey: 'astar' },
  [Chains.MOONBEAM.chainId]: { chainKey: 'moonbeam', nativeTokenKey: 'moonbeam' },
  [Chains.OASIS_EMERALD.chainId]: { chainKey: 'oasis', nativeTokenKey: 'oasis-network' },
  [Chains.ROOTSTOCK.chainId]: { chainKey: 'rootstock', nativeTokenKey: 'rootstock' },
  [Chains.VELAS.chainId]: { chainKey: 'velas', nativeTokenKey: 'velas' },
  [Chains.OKC.chainId]: { chainKey: 'okex-chain', nativeTokenKey: 'oec-token' },
  [Chains.CANTO.chainId]: { chainKey: 'canto', nativeTokenKey: 'canto' },
  [Chains.FUSE.chainId]: { chainKey: 'fuse', nativeTokenKey: 'fuse-network-token' },
  [Chains.ARBITRUM.chainId]: { chainKey: 'arbitrum-one', nativeTokenKey: 'ethereum' },
  [Chains.GNOSIS.chainId]: { chainKey: 'xdai', nativeTokenKey: 'xdai' },
};
export class CoingeckoPriceSource implements IPriceSource {
  constructor(private readonly fetch: IFetchService) {}

  async getCurrentPrices({
    addresses,
    config,
  }: {
    addresses: Record<ChainId, TokenAddress[]>;
    config?: { timeout?: TimeString };
  }): Promise<Record<ChainId, Record<TokenAddress, TokenPrice>>> {
    const reducedTimeout = reduceTimeout(config?.timeout, '100');
    const promises = Object.entries(addresses).map(async ([chainId, addresses]) => [
      Number(chainId),
      await timeoutPromise(this.getCurrentPricesInChain(Number(chainId), addresses, reducedTimeout), reducedTimeout),
    ]);
    return Object.fromEntries(await filterRejectedResults(promises));
  }

  private async getCurrentPricesInChain(chainId: ChainId, addresses: TokenAddress[], timeout?: TimeString) {
    const addressesWithoutNativeToken = addresses.filter((address) => !isSameAddress(address, Addresses.NATIVE_TOKEN));
    const [erc20LowerCased, nativePrice] = await Promise.all([
      this.fetchERC20Prices(chainId, addressesWithoutNativeToken, timeout),
      addressesWithoutNativeToken.length !== addresses.length ? this.fetchNativePrice(chainId, timeout) : undefined,
    ]);
    if (nativePrice) {
      erc20LowerCased[Addresses.NATIVE_TOKEN.toLowerCase()] = nativePrice;
    }
    return Object.fromEntries(addresses.map((address) => [address, erc20LowerCased[address.toLowerCase()]]));
  }

  supportedChains(): ChainId[] {
    return Object.keys(COINGECKO_CHAIN_KEYS).map(Number);
  }

  private async fetchNativePrice(chainId: ChainId, timeout?: TimeString): Promise<TokenPrice> {
    const { nativeTokenKey } = COINGECKO_CHAIN_KEYS[chainId];
    const url = `https://api.coingecko.com/api/v3/simple/price?ids=${nativeTokenKey}&vs_currencies=usd`;
    const response = await this.fetch.fetch(url, { timeout, headers: { Accept: 'application/json' } });
    const body = await response.json();
    return body[nativeTokenKey].usd;
  }

  private async fetchERC20Prices(chainId: ChainId, addresses: TokenAddress[], timeout?: TimeString): Promise<Record<TokenAddress, TokenPrice>> {
    if (addresses.length === 0) return {};
    const url =
      `https://api.coingecko.com/api/v3/simple/token_price/${COINGECKO_CHAIN_KEYS[chainId].chainKey}` +
      `?contract_addresses=${addresses.join(',')}` +
      '&vs_currencies=usd';
    const response = await this.fetch.fetch(url, { timeout });
    const body: TokenPriceResponse = await response.json();
    const entries = Object.entries(body).map(([token, { usd }]) => [token.toLowerCase(), usd]);
    return Object.fromEntries(entries);
  }
}

type TokenPriceResponse = Record<TokenAddress, { usd: TokenPrice }>;
