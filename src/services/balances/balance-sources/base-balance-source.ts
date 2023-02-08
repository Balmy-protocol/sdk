import { BigNumber } from 'ethers';
import { Address, AmountOfToken, ChainId, TimeString, TokenAddress } from '@types';
import { Addresses } from '@shared/constants';
import { filterRejectedResults, isSameAddress } from '@shared/utils';
import { timeoutPromise } from '@shared/timeouts';
import { BalanceQueriesSupport, IBalanceSource } from '../types';

export abstract class BaseBalanceSource implements IBalanceSource {
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
      await timeoutPromise(this.fetchBalancesInChain(parseInt(chainId), account, addresses), context?.timeout, { reduceBy: '100' }),
    ]);
    return Object.fromEntries(await filterRejectedResults(promises));
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
    const support = this.supportedQueries();
    for (const chainId of chains) {
      if (!support[chainId]?.getTokensHeldByAccount) {
        return Promise.reject(new Error('Operation not supported'));
      }
    }
    const promises = chains.map(async (chainId) => [
      chainId,
      await timeoutPromise(this.fetchTokensHeldByAccountInChain(chainId, account, context), context?.timeout, { reduceBy: '100' }),
    ]);
    return Object.fromEntries(await filterRejectedResults(promises));
  }

  private async fetchBalancesInChain(
    chainId: ChainId,
    account: Address,
    addresses: Address[],
    context?: { timeout?: TimeString }
  ): Promise<Record<TokenAddress, AmountOfToken>> {
    const addressesWithoutNativeToken = addresses.filter((address) => !isSameAddress(address, Addresses.NATIVE_TOKEN));

    const erc20Promise =
      addressesWithoutNativeToken.length > 0
        ? this.fetchERC20BalancesInChain(chainId, account, addressesWithoutNativeToken, context)
        : Promise.resolve({});

    const nativePromise =
      addresses.length > addressesWithoutNativeToken.length ? this.fetchNativeBalanceInChain(chainId, account) : Promise.resolve('0');

    const [erc20Result, nativeResult] = await Promise.all([erc20Promise, nativePromise]);

    const lowercasedEntries = Object.entries(erc20Result)
      .filter(([, balance]) => isValidBalance(balance))
      .map(([address, balance]) => [address.toLowerCase(), balance]);
    const lowercased: Record<TokenAddress, AmountOfToken> = Object.fromEntries(lowercasedEntries);

    const result: Record<TokenAddress, AmountOfToken> = {};
    for (const address of addressesWithoutNativeToken) {
      const balance = lowercased[address.toLowerCase()];
      if (balance) {
        result[address] = balance;
      }
    }

    if (isValidBalance(nativeResult)) {
      const nativeAddressUsed = addresses.find((address) => isSameAddress(Addresses.NATIVE_TOKEN, address))!;
      result[nativeAddressUsed] = nativeResult;
    }

    return result;
  }

  private async fetchTokensHeldByAccountInChain(
    chainId: ChainId,
    account: Address,
    context?: { timeout?: TimeString }
  ): Promise<Record<TokenAddress, AmountOfToken>> {
    const erc20Promise = this.fetchERC20TokensHeldByAccountInChain(chainId, account, context);
    const nativePromise = this.fetchNativeBalanceInChain(chainId, account);
    const [erc20Result, nativeResult] = await Promise.all([erc20Promise, nativePromise]);

    const entries = Object.entries(erc20Result).filter(([, balance]) => isValidBalance(balance));
    const result: Record<TokenAddress, AmountOfToken> = Object.fromEntries(entries);

    if (isValidBalance(nativeResult)) {
      result[Addresses.NATIVE_TOKEN] = nativeResult;
    }

    return result;
  }

  abstract supportedQueries(): Record<ChainId, BalanceQueriesSupport>;
  protected abstract fetchERC20TokensHeldByAccountInChain(
    chainId: ChainId,
    account: Address,
    context?: { timeout?: TimeString }
  ): Promise<Record<TokenAddress, AmountOfToken>>;
  protected abstract fetchERC20BalancesInChain(
    chainId: ChainId,
    account: Address,
    addresses: Address[],
    context?: { timeout?: TimeString }
  ): Promise<Record<TokenAddress, AmountOfToken>>;
  protected abstract fetchNativeBalanceInChain(chainId: ChainId, account: Address, context?: { timeout?: TimeString }): Promise<AmountOfToken>;
}

function isValidBalance(text: AmountOfToken) {
  const bn = toBigNumber(text);
  return bn && bn.gt(0);
}

function toBigNumber(text: AmountOfToken): BigNumber | undefined {
  try {
    return BigNumber.from(text);
  } catch {
    return undefined;
  }
}
