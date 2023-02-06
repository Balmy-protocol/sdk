import { BigNumber } from 'ethers';
import { Address, AmountOfToken, ChainId, TimeString, TokenAddress } from '@types';
import { Chains } from '@chains';
import { Addresses } from '@shared/constants';
import { filterRejectedResults, isSameAddress } from '@shared/utils';
import { timeoutPromise } from '@shared/timeouts';
import { BalanceQueriesSupport, IBalanceSource } from '../types';
import { IFetchService } from '@services/fetch';

const URLs: Record<ChainId, string> = {
  [Chains.ETHEREUM.chainId]: 'eth-mainnet.g.alchemy.com/v2',
  [Chains.POLYGON.chainId]: 'polygon-mainnet.g.alchemy.com/v2',
  [Chains.OPTIMISM.chainId]: 'opt-mainnet.g.alchemy.com/v2',
  [Chains.ARBITRUM.chainId]: 'arb-mainnet.g.alchemy.com/v2',
};

// Note: when checking tokens held by an account, Alchemy returns about 300 tokens max
export class AlchemyBalanceSource implements IBalanceSource {
  constructor(private readonly fetchService: IFetchService, private readonly alchemyKey: string) {}

  supportedQueries(): Record<ChainId, BalanceQueriesSupport> {
    const entries = Object.keys(URLs).map((chainId) => [chainId, { getBalancesForTokens: true, getTokensHeldByAccount: true }]);
    return Object.fromEntries(entries);
  }

  async getTokensHeldByAccount({
    account,
    chains,
    context,
  }: {
    account: Address;
    chains: ChainId[];
    context?: { timeout?: TimeString };
  }): Promise<Record<ChainId, Record<TokenAddress, AmountOfToken>>> {
    const promises = chains.map(async (chainId) => [
      chainId,
      await timeoutPromise(this.fetchTokensHeldByAccountInChain(chainId, account, context), context?.timeout, { reduceBy: '100' }),
    ]);
    return Object.fromEntries(await filterRejectedResults(promises));
  }

  async getBalancesForTokens({
    account,
    tokens,
    context,
  }: {
    account: Address;
    tokens: Record<ChainId, TokenAddress[]>;
    context?: { timeout?: TimeString };
  }): Promise<Record<ChainId, Record<TokenAddress, AmountOfToken>>> {
    const promises = Object.entries(tokens).map(async ([chainId, addresses]) => [
      parseInt(chainId),
      await timeoutPromise(this.fetchBalancesInChain(parseInt(chainId), account, addresses, context), context?.timeout, { reduceBy: '100' }),
    ]);
    return Object.fromEntries(await filterRejectedResults(promises));
  }

  private async fetchTokensHeldByAccountInChain(
    chainId: ChainId,
    account: Address,
    context?: { timeout?: TimeString }
  ): Promise<Record<TokenAddress, AmountOfToken>> {
    const [tokenBalances, nativeBalance] = await Promise.all([
      this.fetchERC20sHeldByAccountInChain(chainId, account, context?.timeout),
      this.getNativeBalance(chainId, account),
    ]);
    if (!BigNumber.from(nativeBalance).isZero()) {
      tokenBalances[Addresses.NATIVE_TOKEN] = nativeBalance.toString();
    }
    return tokenBalances;
  }

  private async fetchERC20sHeldByAccountInChain(chainId: ChainId, account: Address, timeout?: TimeString) {
    const allBalances: { contractAddress: TokenAddress; tokenBalance: string | null }[] = [];
    let pageKey: string | undefined = undefined;
    do {
      try {
        const args: any[] = [account, 'erc20'];
        if (pageKey) args.push({ pageKey });
        const result = await this.callRPC<{ tokenBalances: { contractAddress: TokenAddress; tokenBalance: string | null }[]; pageKey?: string }>(
          chainId,
          'alchemy_getTokenBalances',
          args,
          timeout
        );
        allBalances.push(...result.tokenBalances);
        pageKey = result.pageKey;
      } catch (e) {
        pageKey = undefined; // We do this to abort
      }
    } while (!!pageKey);
    return toRecord(allBalances);
  }

  private async fetchBalancesInChain(
    chainId: ChainId,
    account: Address,
    addresses: Address[],
    context?: { timeout?: TimeString }
  ): Promise<Record<TokenAddress, AmountOfToken>> {
    const addressesWithoutNativeToken = addresses.filter((address) => !isSameAddress(address, Addresses.NATIVE_TOKEN));

    const [tokenBalances, nativeBalance] = await Promise.all([
      addressesWithoutNativeToken.length > 0
        ? this.callRPC<{ tokenBalances: { contractAddress: TokenAddress; tokenBalance: string | null }[] }>(
            chainId,
            'alchemy_getTokenBalances',
            [account, addressesWithoutNativeToken],
            context?.timeout
          )
        : { tokenBalances: [] },
      addressesWithoutNativeToken.length !== addresses.length ? this.getNativeBalance(chainId, account) : undefined,
    ]);

    const tokenBalancesRecord = toRecord(tokenBalances.tokenBalances);

    // We do this extra mapping to return the tokens in the addresses they were provided
    const result: Record<TokenAddress, AmountOfToken> = {};
    for (const address of addresses) {
      const value = tokenBalancesRecord[address.toLowerCase()];
      if (value) {
        result[address] = value;
      }
    }

    if (nativeBalance) {
      const nativeAddressUsed = addresses.find((address) => isSameAddress(Addresses.NATIVE_TOKEN, address))!;
      result[nativeAddressUsed] = nativeBalance.toString();
    }

    return result;
  }

  private getNativeBalance(chainId: ChainId, account: Address): Promise<AmountOfToken> {
    return this.callRPC(chainId, 'eth_getBalance', [account, 'latest']);
  }

  private async callRPC<T>(chainId: ChainId, method: string, params: any, timeout?: TimeString): Promise<T> {
    const url = this.getUrl(chainId);
    const response = await this.fetchService.fetch(url, {
      method: 'POST',
      headers: { accept: 'application/json', 'content-type': 'application/json' },
      body: JSON.stringify({
        id: 1,
        jsonrpc: '2.0',
        method,
        params: params,
      }),
      timeout,
    });
    const { result } = await response.json();
    return result;
  }

  private getUrl(chainId: ChainId) {
    const url = URLs[chainId];
    if (!url) throw new Error(`Unsupported chain with id ${chainId}`);
    return `https://${url}/${this.alchemyKey}`;
  }
}

function toRecord(balances: { contractAddress: TokenAddress; tokenBalance: string | null }[]) {
  const tokenBalancesRecord: Record<TokenAddress, AmountOfToken> = {};
  for (const { contractAddress, tokenBalance } of balances) {
    try {
      // We've seen some weird values as amount, so we add the try/catch
      if (tokenBalance && !BigNumber.from(tokenBalance).isZero()) {
        tokenBalancesRecord[contractAddress.toLowerCase()] = tokenBalance;
      }
    } catch {}
  }
  return tokenBalancesRecord;
}
