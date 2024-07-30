import { Address as ViemAddress } from 'viem';
import { Address, ChainId, TimeString, TokenAddress } from '@types';
import { BalanceInput, IBalanceSource } from '../types';
import { IProviderService } from '@services/providers/types';
import ERC20_ABI from '@shared/abis/erc20';
import { MULTICALL_CONTRACT } from '@services/providers/utils';
import { filterRejectedResults, groupByChain, isSameAddress } from '@shared/utils';
import { Addresses } from '@shared/constants';
import { timeoutPromise } from '@shared/timeouts';
import { ILogger, ILogsService } from '@services/logs';

export type RPCBalanceSourceConfig = {
  batching?: { maxSizeInBytes: number };
};
export class RPCBalanceSource implements IBalanceSource {
  private readonly logger: ILogger;
  constructor(
    private readonly providerService: IProviderService,
    logs: ILogsService,
    private readonly config?: RPCBalanceSourceConfig | undefined
  ) {
    this.logger = logs.getLogger({ name: 'RPCBalanceSource' });
  }

  async getBalances({
    tokens,
    config,
  }: {
    tokens: BalanceInput[];
    config?: { timeout?: TimeString };
  }): Promise<Record<ChainId, Record<Address, Record<TokenAddress, bigint>>>> {
    const groupedByChain = groupByChain(tokens);
    const promises = Object.entries(groupedByChain).map<Promise<[ChainId, Record<Address, Record<TokenAddress, bigint>>]>>(
      async ([chainId, tokens]) => [
        Number(chainId),
        await timeoutPromise(this.fetchBalancesInChain(Number(chainId), tokens), config?.timeout, {
          reduceBy: '100',
          onTimeout: (timeout) => this.logger.debug(`Fetch balances in chain ${chainId} timeouted after ${timeout}`),
        }),
      ]
    );
    return Object.fromEntries(await filterRejectedResults(promises));
  }

  supportedChains(): ChainId[] {
    return this.providerService.supportedChains();
  }

  private async fetchBalancesInChain(
    chainId: ChainId,
    tokens: Omit<BalanceInput, 'chainId'>[],
    config?: { timeout?: TimeString }
  ): Promise<Record<Address, Record<TokenAddress, bigint>>> {
    const accountsToFetchNativeToken: Address[] = [];
    const nonNativeTokens: Omit<BalanceInput, 'chainId'>[] = [];

    for (const { account, token } of tokens) {
      if (isSameAddress(token, Addresses.NATIVE_TOKEN)) {
        accountsToFetchNativeToken.push(account);
      } else {
        nonNativeTokens.push({ account, token });
      }
    }

    const erc20Promise =
      Object.keys(nonNativeTokens).length > 0
        ? this.fetchERC20BalancesInChain(chainId, nonNativeTokens, config)
        : Promise.resolve<Record<Address, Record<TokenAddress, bigint>>>({});

    const nativePromise =
      accountsToFetchNativeToken.length > 0
        ? this.fetchNativeBalancesInChain(chainId, accountsToFetchNativeToken, config)
        : Promise.resolve<Record<Address, bigint>>({});

    const [erc20Result, nativeResult] = await Promise.all([erc20Promise, nativePromise]);

    const result: Record<Address, Record<TokenAddress, bigint>> = {};

    for (const { account, token } of tokens) {
      const balance = isSameAddress(token, Addresses.NATIVE_TOKEN) ? nativeResult[account] : erc20Result[account]?.[token];

      if (balance !== undefined) {
        if (!(account in result)) result[account] = {};
        result[account][token] = balance;
      }
    }

    return result;
  }

  private async fetchERC20BalancesInChain(
    chainId: ChainId,
    tokens: Omit<BalanceInput, 'chainId'>[],
    config?: { timeout?: TimeString }
  ): Promise<Record<Address, Record<TokenAddress, bigint>>> {
    const contracts = tokens.map(({ account, token }) => ({
      address: token as ViemAddress,
      abi: ERC20_ABI,
      functionName: 'balanceOf',
      args: [account],
    }));
    const multicallResults = contracts.length
      ? await this.providerService
          .getViemPublicClient({ chainId })
          .multicall({
            contracts,
            multicallAddress: MULTICALL_CONTRACT.address(chainId),
            batchSize: this.config?.batching?.maxSizeInBytes ?? 0,
          })
          .catch((e) => {
            this.logger.debug(e);
            return Promise.reject(e);
          })
      : [];
    const result: Record<Address, Record<TokenAddress, bigint>> = {};
    for (let i = 0; i < tokens.length; i++) {
      const multicallResult = multicallResults[i];
      if (multicallResult.status === 'failure') continue;
      const { account, token } = tokens[i];
      if (!(account in result)) result[account] = {};
      result[account][token] = multicallResult.result as unknown as bigint;
    }
    return result;
  }

  private async fetchNativeBalancesInChain(
    chainId: ChainId,
    accounts: Address[],
    config?: { timeout?: TimeString }
  ): Promise<Record<Address, bigint>> {
    const entries = await Promise.all(
      accounts.map(async (account) => [
        account,
        await this.fetchNativeBalanceInChain(chainId, account).catch((e) => {
          this.logger.debug(e);
          return Promise.reject(e);
        }),
      ])
    );
    return Object.fromEntries(entries);
  }

  private fetchNativeBalanceInChain(chainId: ChainId, account: Address, config?: { timeout?: TimeString }) {
    return this.providerService.getViemPublicClient({ chainId }).getBalance({ address: account as ViemAddress, blockTag: 'latest' });
  }
}
