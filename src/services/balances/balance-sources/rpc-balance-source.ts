import { Address as ViemAddress } from 'viem';
import { Address, ChainId, TimeString, TokenAddress } from '@types';
import { IMulticallService } from '@services/multicall';
import { chainsIntersection } from '@chains';
import { BalanceQueriesSupport } from '../types';
import { IProviderService } from '@services/providers/types';
import { SingleChainBaseBalanceSource } from './base/single-chain-base-balance-source';
import ERC20_ABI from '@shared/abis/erc20';

export type RPCBalanceSourceConfig = {
  batching?: { maxSizeInBytes: number };
};
export class RPCBalanceSource extends SingleChainBaseBalanceSource {
  constructor(
    private readonly providerService: IProviderService,
    private readonly multicallService: IMulticallService,
    private readonly config?: RPCBalanceSourceConfig | undefined
  ) {
    super();
  }

  supportedQueries(): Record<ChainId, BalanceQueriesSupport> {
    const supportedChains = chainsIntersection(this.providerService.supportedChains(), this.multicallService.supportedChains());
    const entries = supportedChains.map((chainId) => [chainId, { getBalancesForTokens: true, getTokensHeldByAccount: false }]);
    return Object.fromEntries(entries);
  }

  protected fetchERC20TokensHeldByAccountsInChain(
    chainId: ChainId,
    accounts: Address[],
    config?: { timeout?: TimeString }
  ): Promise<Record<Address, Record<TokenAddress, bigint>>> {
    throw new Error('Operation not supported');
  }

  protected async fetchERC20BalancesForAccountsInChain(
    chainId: ChainId,
    accounts: Record<Address, TokenAddress[]>,
    config?: { timeout?: TimeString }
  ): Promise<Record<Address, Record<TokenAddress, bigint>>> {
    const pairs = Object.entries(accounts).flatMap(([account, tokens]) => tokens.map((token) => ({ account, token })));
    const calls = pairs.map(({ account, token }) => ({
      address: token,
      abi: { json: ERC20_ABI },
      functionName: 'balanceOf',
      args: [account],
    }));
    const multicallResults = await this.multicallService.tryReadOnlyMulticall({
      chainId,
      calls,
      ...this.config,
    });
    const result: Record<Address, Record<TokenAddress, bigint>> = {};
    for (let i = 0; i < pairs.length; i++) {
      const multicallResult = multicallResults[i];
      if (multicallResult.status === 'failure') continue;
      const { account, token } = pairs[i];
      if (!(account in result)) result[account] = {};
      result[account][token] = multicallResult.result.toString();
    }
    return result;
  }

  protected async fetchNativeBalancesInChain(
    chainId: ChainId,
    accounts: Address[],
    config?: { timeout?: TimeString }
  ): Promise<Record<Address, bigint>> {
    const entries = accounts.map(async (account) => [account, await this.fetchNativeBalanceInChain(chainId, account)]);
    return Object.fromEntries(await Promise.all(entries));
  }

  private fetchNativeBalanceInChain(chainId: ChainId, account: Address) {
    const viemSupported = this.providerService.supportedClients()[chainId]?.viem;
    return viemSupported
      ? this.providerService
          .getViemPublicClient({ chainId })
          .getBalance({ address: account as ViemAddress, blockTag: 'latest' })
          .then((balance) => balance.toString())
      : this.providerService
          .getEthersProvider({ chainId })
          .getBalance(account)
          .then((balance) => balance.toString());
  }
}
