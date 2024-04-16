import { Address, ChainId, TimeString, TokenAddress } from '@types';
import { SingleChainBaseBalanceSource } from './single-chain-base-balance-source';

export abstract class SingleAccountAndChainBaseBalanceSource extends SingleChainBaseBalanceSource {
  protected async fetchERC20TokensHeldByAccountsInChain(
    chainId: ChainId,
    accounts: Address[],
    config?: { timeout?: TimeString }
  ): Promise<Record<Address, Record<TokenAddress, bigint>>> {
    const entries = accounts.map(async (account) => [account, await this.fetchERC20TokensHeldByAccountInChain(chainId, account, config)]);
    return Object.fromEntries(await Promise.all(entries));
  }

  protected async fetchERC20BalancesForAccountsInChain(
    chainId: ChainId,
    accounts: Record<Address, TokenAddress[]>,
    config?: { timeout?: TimeString }
  ): Promise<Record<Address, Record<TokenAddress, bigint>>> {
    const entries = Object.entries(accounts).map(async ([account, tokens]) => [
      account,
      await this.fetchERC20BalancesForAccountInChain(chainId, account, tokens, config),
    ]);
    return Object.fromEntries(await Promise.all(entries));
  }

  protected async fetchNativeBalancesInChain(
    chainId: ChainId,
    accounts: Address[],
    config?: { timeout?: TimeString }
  ): Promise<Record<Address, bigint>> {
    const entries = accounts.map(async (account) => [account, await this.fetchNativeBalanceInChain(chainId, account, config)]);
    return Object.fromEntries(await Promise.all(entries));
  }

  protected abstract fetchERC20TokensHeldByAccountInChain(
    chainId: ChainId,
    account: Address,
    config?: { timeout?: TimeString }
  ): Promise<Record<TokenAddress, bigint>>;
  protected abstract fetchERC20BalancesForAccountInChain(
    chainId: ChainId,
    account: Address,
    addresses: TokenAddress[],
    config?: { timeout?: TimeString }
  ): Promise<Record<TokenAddress, bigint>>;
  protected abstract fetchNativeBalanceInChain(chainId: ChainId, account: Address, config?: { timeout?: TimeString }): Promise<bigint>;
}
