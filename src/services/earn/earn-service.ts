import { Address, BigIntish, BuiltTransaction, ChainId, Timestamp, TimeString, TokenAddress } from '@types';
import {
  ClaimDelayedWithdrawPositionParams,
  CreateEarnPositionParams,
  DetailedStrategy,
  EarnActionSwapConfig,
  EarnDomain,
  EarnPermission,
  EarnPermissionData,
  EarnPermissionDataMessage,
  EarnPermissionPermit,
  EarnPermissions,
  EarnPermissionSet,
  EarnPosition,
  FarmId,
  Guardian,
  GuardianId,
  HistoricalData,
  IEarnService,
  IncreaseEarnPositionParams,
  PositionId,
  SpecialWithdrawalCode,
  Strategy,
  StrategyGuardian,
  StrategyId,
  StrategyRiskLevel,
  StrategyYieldType,
  Token,
  TYPES,
  WithdrawEarnPositionParams,
  WithdrawType,
} from './types';
import { COMPANION_SWAPPER_CONTRACT, DELAYED_WITHDRAWAL_MANAGER, EARN_STRATEGY_REGISTRY, EARN_VAULT, EARN_VAULT_COMPANION } from './config';
import { encodeFunctionData, Hex, Address as ViemAddress } from 'viem';
import vaultAbi from '@shared/abis/earn-vault';
import companionAbi from '@shared/abis/earn-vault-companion';
import strategyRegistryAbi from '@shared/abis/earn-strategy-registry';
import strategyAbi from '@shared/abis/earn-strategy';
import delayerWithdrawalManagerAbi from '@shared/abis/earn-delayed-withdrawal-manager';
import { calculateDeadline, isSameAddress, toAmountsOfToken, toLower } from '@shared/utils';
import { Addresses, Uint } from '@shared/constants';
import { GenericContractCall, IPermit2Service, PermitData, SinglePermitParams } from '@services/permit2';
import { IQuoteService, QuoteRequest } from '@services/quotes';
import { IProviderService } from '@services/providers';
import { MULTICALL_CONTRACT } from '@services/providers/utils';
import { IAllowanceService } from '@services/allowances';
import { PERMIT2_CONTRACT } from '@services/permit2/utils/config';
import qs from 'qs';
import { IFetchService } from '@services/fetch';
import { ArrayOneOrMore } from '@utility-types';

export class EarnService implements IEarnService {
  constructor(
    private readonly apiUrl: string,
    private readonly permit2Service: IPermit2Service,
    private readonly quoteService: IQuoteService,
    private readonly providerService: IProviderService,
    private readonly allowanceService: IAllowanceService,
    private readonly fetchService: IFetchService
  ) {}

  async getPositionsByAccount({
    accounts,
    chains,
    includeHistory,
    includeHistoricalBalancesFrom,
    config,
  }: {
    accounts: ArrayOneOrMore<Address>;
    chains?: ChainId[];
    includeHistory?: boolean;
    includeHistoricalBalancesFrom?: Timestamp;
    config?: { timeout?: TimeString };
  }) {
    return await this.getPositions({ accounts, chains, includeHistory, includeHistoricalBalancesFrom, config });
  }

  async getPositionsById({
    ids,
    chains,
    includeHistory,
    includeHistoricalBalancesFrom,
    config,
  }: {
    ids: ArrayOneOrMore<PositionId>;
    chains?: ChainId[];
    includeHistory?: boolean;
    includeHistoricalBalancesFrom?: Timestamp;
    config?: { timeout?: TimeString };
  }) {
    return await this.getPositions({ ids, chains, includeHistory, includeHistoricalBalancesFrom, config });
  }

  private async getPositions(args: GetPositionsParams) {
    const { chains, includeHistory, includeHistoricalBalancesFrom, config } = args;

    const baseQueryParams = {
      chains,
      includeHistory,
      includeHistoricalBalancesFrom,
    };

    let queryParams;
    if ('accounts' in args) {
      queryParams = { ...baseQueryParams, users: args.accounts };
    } else if ('ids' in args) {
      queryParams = { ...baseQueryParams, ids: args.ids };
    }

    const params = qs.stringify(queryParams, { arrayFormat: 'comma', skipNulls: true });
    const url = `${this.apiUrl}/v1/earn/positions?${params}`;
    const response = await this.fetchService.fetch(url, { timeout: config?.timeout });
    const body: GetPositionsResponse = await response.json();
    const result: Record<ChainId, EarnPosition[]> = {};
    Object.entries(body.positionsByNetwork).forEach(([stringChainId, positionsInThisNetwork]) => {
      const chainId = Number(stringChainId) as ChainId;
      result[chainId] = positionsInThisNetwork.positions.map((position) => {
        const { strategyId, balances, ...restPosition } = position;
        const strategyResponse = positionsInThisNetwork.strategies[strategyId];
        return {
          ...restPosition,
          balances: fulfillBalance(balances, positionsInThisNetwork.tokens),
          strategy: fulfillStrategy(strategyResponse, positionsInThisNetwork.tokens, body.guardians),
          delayed: position.delayed?.map(({ token, pending, ready }) => ({
            token: { ...positionsInThisNetwork.tokens[token], address: token },
            pending: toAmountsOfToken({
              decimals: positionsInThisNetwork.tokens[token].decimals,
              price: positionsInThisNetwork.tokens[token].price,
              amount: pending,
            }),
            ready: toAmountsOfToken({
              decimals: positionsInThisNetwork.tokens[token].decimals,
              price: positionsInThisNetwork.tokens[token].price,
              amount: ready,
            }),
          })),
          history:
            includeHistory && position.history
              ? position.history.map((history) => fulfillHistory(history, strategyResponse.farm.asset.address, positionsInThisNetwork.tokens))
              : undefined,
          historicalBalances:
            includeHistoricalBalancesFrom && position.historicalBalances
              ? position.historicalBalances.map((historicalBalance) =>
                  fulfillHistoricalBalance(historicalBalance, positionsInThisNetwork.tokens)
                )
              : undefined,
        };
      });
    });
    return result;
  }

  async getSupportedStrategies(args?: { chains?: ChainId[]; config?: { timeout: TimeString } }) {
    const params = qs.stringify({ chains: args?.chains }, { arrayFormat: 'comma', skipNulls: true });
    const url = `${this.apiUrl}/v1/earn/strategies/supported?${params}`;
    const response = await this.fetchService.fetch(url, { timeout: args?.config?.timeout });
    const body: GetSupportedStrategiesResponse = await response.json();
    const result: Record<ChainId, Strategy[]> = {};
    Object.entries(body.strategiesByNetwork).forEach(([stringChainId, { strategies, tokens }]) => {
      const chainId = Number(stringChainId) as ChainId;
      result[chainId] = strategies.map((strategyResponse) => fulfillStrategy(strategyResponse, tokens, body.guardians));
    });
    return result;
  }

  async getStrategy(args?: { strategy: StrategyId; config?: { timeout?: TimeString } }) {
    const url = `${this.apiUrl}/v1/earn/strategies/${args?.strategy}`;
    const response = await this.fetchService.fetch(url, { timeout: args?.config?.timeout });
    const body: GetStrategyResponse = await response.json();
    return fulfillStrategy(body.strategy, body.tokens, {}) as DetailedStrategy;
  }

  preparePermitData(args: SinglePermitParams): Promise<PermitData> {
    return this.permit2Service.preparePermitData({ ...args, spender: EARN_VAULT_COMPANION.address(args.chainId) });
  }

  async preparePermissionData({
    chainId,
    positionId,
    permissions,
    signerAddress,
    signatureValidFor,
  }: {
    chainId: ChainId;
    positionId: PositionId;
    permissions: EarnPermissionSet[];
    signerAddress: Address;
    signatureValidFor: TimeString;
  }): Promise<EarnPermissionData> {
    const [, , stringPositionId] = positionId.split('-');
    const bigIntPositionId = BigInt(stringPositionId);

    const deadline = BigInt(calculateDeadline(signatureValidFor));
    const domain: EarnDomain = {
      name: 'Balmy Earn NFT Position',
      verifyingContract: EARN_VAULT.address(chainId),
      chainId,
      version: '1.0',
    };

    const nonce = await this.providerService.getViemPublicClient({ chainId }).readContract({
      address: EARN_VAULT.address(chainId),
      abi: vaultAbi,
      functionName: 'nextNonce',
      args: [signerAddress as ViemAddress],
    });

    const message: EarnPermissionDataMessage = {
      positions: [
        {
          positionId: bigIntPositionId,
          permissionSets: permissions.map(({ operator, permissions }) => ({
            operator: operator as ViemAddress,
            permissions: permissions.map(mapPermission),
          })),
        },
      ],
      nonce,
      deadline,
    };

    return {
      dataToSign: {
        types: TYPES,
        domain,
        message,
        primaryType: 'PermissionPermit',
      },
      permitData: {
        permissions,
        tokenId: bigIntPositionId.toString(),
        deadline,
      },
    };
  }

  async getAllowanceTarget({
    chainId,
    strategyId,
    depositWith,
    usePermit2,
  }: {
    chainId: ChainId;
    strategyId: StrategyId;
    depositWith: TokenAddress;
    usePermit2?: boolean;
  }): Promise<ViemAddress | undefined> {
    if (isSameAddress(depositWith, Addresses.NATIVE_TOKEN)) {
      return undefined;
    } else if (usePermit2) {
      return PERMIT2_CONTRACT.address(chainId);
    }
    const [, , numericStrategyId] = strategyId.split('-');
    const { needsSwap } = await this.checkIfNeedsSwap({ chainId, strategyId: BigInt(numericStrategyId), depositToken: depositWith });
    if (needsSwap) {
      return EARN_VAULT_COMPANION.address(chainId);
    } else {
      return EARN_VAULT.address(chainId);
    }
  }

  async buildCreatePositionTx({
    chainId,
    strategyId,
    owner,
    permissions,
    strategyValidationData,
    misc,
    deposit,
  }: CreateEarnPositionParams): Promise<BuiltTransaction> {
    const vault = EARN_VAULT.address(chainId);
    const companion = EARN_VAULT_COMPANION.address(chainId);
    let depositInfo: { token: Address; amount: bigint; value: bigint };
    if ('token' in deposit) {
      const amount = BigInt(deposit.amount);
      depositInfo = { token: deposit.token, amount, value: isSameAddress(deposit.token, Addresses.NATIVE_TOKEN) ? amount : 0n };
    } else {
      depositInfo = { token: deposit.permitData.token, amount: BigInt(deposit.permitData.amount), value: 0n };
    }
    const [, , numericStrategyId] = strategyId.split('-');
    const { needsSwap, asset } = await this.checkIfNeedsSwap({
      chainId,
      strategyId: BigInt(numericStrategyId),
      depositToken: depositInfo.token,
    });

    if ('token' in deposit && !needsSwap) {
      // If don't need to use Permit2, then just call the vault
      return {
        to: vault,
        data: encodeFunctionData({
          abi: vaultAbi,
          functionName: 'createPosition',
          args: [
            BigInt(numericStrategyId),
            depositInfo.token as ViemAddress,
            depositInfo.amount,
            owner as ViemAddress,
            permissions.map(({ operator, permissions }) => ({
              operator: operator as ViemAddress,
              permissions: permissions.map(mapPermission),
            })),
            strategyValidationData ?? '0x',
            misc ?? '0x',
          ],
        }),
        value: depositInfo.value,
      };
    }
    // If we get to this point, then we'll use the Companion for the deposit
    const calls: Hex[] = [];

    // Handle take from caller (if necessary)
    const recipient = needsSwap ? COMPANION_SWAPPER_CONTRACT.address(chainId) : companion;
    if ('permitData' in deposit) {
      calls.push(buildTakeFromCallerWithPermit(deposit.permitData, deposit.signature, recipient));
    } else if (!isSameAddress(depositInfo.token, Addresses.NATIVE_TOKEN)) {
      calls.push(buildTakeFromCaller(depositInfo.token, depositInfo.amount, recipient));
    }

    const depositToken = (needsSwap ? asset : depositInfo.token) as ViemAddress;
    let maxApprove = false;
    const promises = [];

    if (needsSwap) {
      const swapPromise = this.getSwapData({
        request: {
          chainId,
          sellToken: depositInfo.token,
          buyToken: asset,
          order: { type: 'sell', sellAmount: depositInfo.amount },
        },
        leftoverRecipient: owner,
        swapConfig: deposit?.swapConfig,
      }).then(({ swapData }) => calls.push(swapData));
      promises.push(swapPromise);
    }

    if (!isSameAddress(depositToken, Addresses.NATIVE_TOKEN)) {
      const allowancePromise = this.allowanceService
        .getAllowanceInChain({
          chainId,
          owner: companion,
          spender: vault,
          token: depositToken,
        })
        .then((allowance) => {
          // Only if the allowance is 0 we need to max approve the vault
          maxApprove = allowance === 0n;
        });
      promises.push(allowancePromise);
    }

    await Promise.all(promises);

    // Handle deposit
    calls.push(
      encodeFunctionData({
        abi: companionAbi,
        functionName: 'createPosition',
        args: [
          vault,
          BigInt(numericStrategyId),
          depositToken,
          Uint.MAX_256,
          owner as ViemAddress,
          permissions.map(({ operator, permissions }) => ({
            operator: operator as ViemAddress,
            permissions: permissions.map(mapPermission),
          })),
          strategyValidationData ?? '0x',
          misc ?? '0x',
          maxApprove,
        ],
      })
    );

    // Build multicall and return tx
    return buildCompanionMulticall({ chainId, calls, value: depositInfo.value });
  }

  async buildIncreasePositionTx({ chainId, positionId, increase, permissionPermit }: IncreaseEarnPositionParams): Promise<BuiltTransaction> {
    const vault = EARN_VAULT.address(chainId);
    const companion = EARN_VAULT_COMPANION.address(chainId);
    let increaseInfo: { token: Address; amount: bigint; value: bigint };
    if ('token' in increase) {
      const amount = BigInt(increase.amount);
      increaseInfo = { token: increase.token, amount, value: isSameAddress(increase.token, Addresses.NATIVE_TOKEN) ? amount : 0n };
    } else {
      increaseInfo = { token: increase.permitData.token, amount: BigInt(increase.permitData.amount), value: 0n };
    }

    if (increaseInfo.amount === 0n) {
      throw new Error('Amount cannot be 0');
    }

    const [, , tokenId] = positionId.split('-');
    const bigIntPositionId = BigInt(tokenId);
    const [positionOwner, strategyId] = await this.providerService.getViemPublicClient({ chainId }).multicall({
      contracts: [
        {
          abi: vaultAbi,
          address: vault,
          functionName: 'ownerOf',
          args: [bigIntPositionId],
        },
        {
          abi: vaultAbi,
          address: vault,
          functionName: 'positionsStrategy',
          args: [bigIntPositionId],
        },
      ],
      allowFailure: false,
    });
    const { needsSwap, asset } = await this.checkIfNeedsSwap({ chainId, strategyId, depositToken: increaseInfo.token });

    if ('token' in increase && !needsSwap) {
      // If don't need to use Permit2, then just call the vault
      return {
        to: vault,
        data: encodeFunctionData({
          abi: vaultAbi,
          functionName: 'increasePosition',
          args: [bigIntPositionId, increaseInfo.token as ViemAddress, increaseInfo.amount],
        }),
        value: increaseInfo.value,
      };
    }

    // If we get to this point, then we'll use the Companion for the increase
    const calls: Hex[] = [];

    const recipient = needsSwap ? COMPANION_SWAPPER_CONTRACT.address(chainId) : companion;
    if ('permitData' in increase) {
      // Handle take from caller (if necessary)
      calls.push(buildTakeFromCallerWithPermit(increase.permitData, increase.signature, recipient));
    } else if (!isSameAddress(increaseInfo.token, Addresses.NATIVE_TOKEN)) {
      calls.push(buildTakeFromCaller(increaseInfo.token, increaseInfo.amount, recipient));
    }

    const depositToken = (needsSwap ? asset : increaseInfo.token) as ViemAddress;
    let maxApprove = false;
    const promises = [];

    if (needsSwap) {
      const swapPromise = await this.getSwapData({
        request: {
          chainId,
          sellToken: increaseInfo.token,
          buyToken: asset,
          order: { type: 'sell', sellAmount: increaseInfo.amount },
        },
        leftoverRecipient: positionOwner,
        swapConfig: increase?.swapConfig,
      }).then(({ swapData }) => calls.push(swapData));
      promises.push(swapPromise);
    }

    if (!isSameAddress(depositToken, Addresses.NATIVE_TOKEN)) {
      const allowancePromise = this.allowanceService
        .getAllowanceInChain({
          chainId,
          owner: companion,
          spender: vault,
          token: depositToken,
        })
        .then((allowance) => {
          // Only if the allowance is 0 we need to max approve the vault
          maxApprove = allowance === 0n;
        });
      promises.push(allowancePromise);
    }

    await Promise.all(promises);

    // Handle permission permit
    if (permissionPermit) {
      calls.push(buildPermissionPermit(bigIntPositionId, permissionPermit, vault));
    }

    // Handle increase
    calls.push(
      encodeFunctionData({
        abi: companionAbi,
        functionName: 'increasePosition',
        args: [vault as ViemAddress, bigIntPositionId, asset, Uint.MAX_256, maxApprove],
      })
    );

    // Build multicall and return tx
    return buildCompanionMulticall({ chainId, calls, value: increaseInfo.value });
  }

  async buildClaimDelayedWithdrawPositionTx({
    chainId,
    positionId,
    recipient,
    permissionPermit,
    claim,
  }: ClaimDelayedWithdrawPositionParams): Promise<BuiltTransaction> {
    const vault = EARN_VAULT.address(chainId);
    const manager = DELAYED_WITHDRAWAL_MANAGER.address(chainId);
    const [, , tokenId] = positionId.split('-');
    const bigIntPositionId = BigInt(tokenId);

    // Get withdrawable funds for each token to convert
    const withdrawableFunds = await this.providerService.getViemPublicClient({ chainId }).multicall({
      contracts: claim.tokens.map(({ token }) => ({
        address: manager as ViemAddress,
        abi: delayerWithdrawalManagerAbi,
        functionName: 'withdrawableFunds' as const,
        args: [bigIntPositionId, token as ViemAddress],
      })),
      allowFailure: false,
    });

    const claimWithFunds = claim.tokens
      .map((token, index) => ({ ...token, amount: withdrawableFunds[index] }))
      .filter(({ amount }) => amount > 0n);
    if (claimWithFunds.length == 0) {
      throw new Error('No funds to claim');
    }
    const claimsToConvert = claimWithFunds.filter(({ convertTo }) => !!convertTo);

    if (claimsToConvert.length == 0) {
      // If don't need to convert anything, then just call the delayer withdrawal manager
      const calls = claimWithFunds.map(({ token }) =>
        encodeFunctionData({
          abi: delayerWithdrawalManagerAbi,
          functionName: 'withdraw',
          args: [bigIntPositionId, token as ViemAddress, recipient as ViemAddress],
        })
      );

      return {
        to: manager,
        data: encodeFunctionData({
          abi: delayerWithdrawalManagerAbi,
          functionName: 'multicall',
          args: [calls],
        }),
      };
    }

    // If we get to this point, then we'll use the Companion for swap & transfer
    const calls: Hex[] = [];

    // Handle permission permit
    if (permissionPermit) {
      calls.push(buildPermissionPermit(bigIntPositionId, permissionPermit, vault));
    }

    // Handle claim
    calls.push(
      ...claimWithFunds.map(({ token, convertTo }) =>
        encodeFunctionData({
          abi: companionAbi,
          functionName: 'claimDelayedWithdraw',
          args: [
            manager,
            bigIntPositionId,
            token as ViemAddress,
            !!convertTo ? COMPANION_SWAPPER_CONTRACT.address(chainId) : (recipient as ViemAddress),
          ],
        })
      )
    );

    const withdrawsToConvert = claimsToConvert.map(({ token, convertTo, amount }) => ({
      chainId,
      sellToken: token,
      buyToken: convertTo!,
      order: { type: 'sell' as const, sellAmount: amount },
    }));

    // Handle swaps
    const swapAndTransferData = await this.getSwapAndTransferData({
      chainId,
      swaps: {
        requests: withdrawsToConvert,
        swapConfig: claim.swapConfig,
      },
      recipient,
    });

    calls.push(swapAndTransferData);

    // Build multicall and return tx
    return buildCompanionMulticall({ chainId, calls });
  }
  async estimateMarketWithdraw({
    chainId,
    positionId,
    token,
    amount,
    swapConfig,
  }: {
    chainId: ChainId;
    positionId: PositionId;
    token: TokenAddress;
    amount: BigIntish;
    swapConfig?: EarnActionSwapConfig;
  }) {
    const vault = EARN_VAULT.address(chainId);
    const [, , tokenId] = positionId.split('-');
    const bigIntPositionId = BigInt(tokenId);
    const strategyId = await this.providerService.getViemPublicClient({ chainId }).readContract({
      address: vault,
      abi: vaultAbi,
      functionName: 'positionsStrategy',
      args: [bigIntPositionId],
    });

    const strategyAddress = await this.providerService.getViemPublicClient({ chainId }).readContract({
      address: EARN_STRATEGY_REGISTRY.address(chainId),
      abi: strategyRegistryAbi,
      functionName: 'getStrategy',
      args: [strategyId],
    });

    let amountToWithdraw = BigInt(amount);
    if (amount == Uint.MAX_256) {
      const [, balance] = await this.providerService.getViemPublicClient({ chainId }).readContract({
        address: vault,
        abi: vaultAbi,
        functionName: 'position',
        args: [bigIntPositionId],
      });
      amountToWithdraw = balance[0];
    }
    const { result } = await this.providerService.getViemPublicClient({ chainId }).simulateContract({
      address: strategyAddress as ViemAddress,
      account: vault,
      abi: strategyAbi,
      functionName: 'specialWithdraw',
      args: [
        bigIntPositionId,
        BigInt(SpecialWithdrawalCode.WITHDRAW_ASSET_FARM_TOKEN_BY_ASSET_AMOUNT),
        [amountToWithdraw],
        '0x',
        COMPANION_SWAPPER_CONTRACT.address(chainId),
      ],
    });

    const [, actualWithdrawnTokens, actualWithdrawnAmounts] = result;
    const estimateQuote = await this.quoteService.getBestQuote({
      request: {
        chainId,
        sellToken: actualWithdrawnTokens[0], // Farm token
        buyToken: token,
        order: { type: 'sell', sellAmount: actualWithdrawnAmounts[0] }, // Amount of farm token to convert
        slippagePercentage: swapConfig?.slippagePercentage ?? 0.3,
        takerAddress: strategyAddress,
      },
    });
    return estimateQuote.buyAmount;
  }

  async buildWithdrawPositionTx({
    chainId,
    positionId,
    withdraw,
    recipient,
    caller,
    permissionPermit,
  }: WithdrawEarnPositionParams): Promise<BuiltTransaction> {
    const vault = EARN_VAULT.address(chainId);
    const [, , tokenId] = positionId.split('-');
    const bigIntPositionId = BigInt(tokenId);
    const tokensToWithdraw = withdraw.amounts.map(({ token }) => token as ViemAddress);
    const intendedWithdraw = withdraw.amounts.map(({ amount }) => BigInt(amount));
    if (withdraw.amounts.some(({ convertTo, type }) => !!convertTo && type == WithdrawType.DELAYED)) {
      throw new Error('Can not convert delayed withdrawals');
    }
    const shouldConvertAnyToken = withdraw.amounts.some(({ convertTo }) => !!convertTo);
    const marketWithdrawalsTypes = withdraw.amounts.filter(({ type }) => type == WithdrawType.MARKET);
    const shouldWithdrawFarmToken = marketWithdrawalsTypes.length > 0;
    if (marketWithdrawalsTypes.length > 1 || (shouldWithdrawFarmToken && withdraw.amounts[0].type != WithdrawType.MARKET)) {
      throw new Error('Only one withdraw type MARKET is allowed, and it should be the first one');
    }
    if (!shouldConvertAnyToken && !shouldWithdrawFarmToken) {
      // If don't need to convert anything, then just call the vault
      return {
        to: vault,
        data: encodeFunctionData({
          abi: vaultAbi,
          functionName: 'withdraw',
          args: [BigInt(bigIntPositionId), tokensToWithdraw, intendedWithdraw, recipient as ViemAddress],
        }),
      };
    }

    // If we get to this point, then we'll use the Companion for swap & transfer
    const calls: Hex[] = [];

    // Handle permission permit
    if (permissionPermit) {
      calls.push(buildPermissionPermit(bigIntPositionId, permissionPermit, vault));
    }

    const shouldCallWithdraw =
      !shouldWithdrawFarmToken || withdraw.amounts.some(({ type, amount }) => type != WithdrawType.MARKET && BigInt(amount) >= 0n);
    if (shouldCallWithdraw) {
      // Handle withdraw
      calls.push(
        encodeFunctionData({
          abi: companionAbi,
          functionName: 'withdraw',
          args: [
            vault as ViemAddress,
            bigIntPositionId,
            tokensToWithdraw,
            intendedWithdraw.map((amount, index) => (withdraw.amounts[index].type != WithdrawType.MARKET ? amount : 0n)),
            COMPANION_SWAPPER_CONTRACT.address(chainId),
          ],
        })
      );
    }

    let balancesFromVault: Record<TokenAddress, bigint> = {};
    // If any token amount to convert is MAX_UINT256 or we are withdrawing the farm token, then we need to check vault balance
    if (shouldWithdrawFarmToken || withdraw.amounts.some(({ convertTo, amount }) => !!convertTo && amount == Uint.MAX_256)) {
      const [positionTokens, positionBalances] = await this.providerService.getViemPublicClient({ chainId }).readContract({
        abi: vaultAbi,
        address: vault,
        functionName: 'position',
        args: [bigIntPositionId],
      });
      balancesFromVault = Object.fromEntries(positionTokens.map((token, index) => [toLower(token), positionBalances[index]]));
    }
    // Handle swaps
    const withdrawsToConvert = withdraw.amounts
      .filter(({ convertTo }) => !!convertTo)
      .map(({ token, amount, convertTo }) => ({
        chainId,
        sellToken: token,
        buyToken: convertTo!,
        order: { type: 'sell' as const, sellAmount: amount != Uint.MAX_256 ? amount : balancesFromVault[token] },
      }));

    // Handle special withdraw
    if (shouldWithdrawFarmToken) {
      const basicArgs = [
        bigIntPositionId,
        BigInt(SpecialWithdrawalCode.WITHDRAW_ASSET_FARM_TOKEN_BY_ASSET_AMOUNT),
        [intendedWithdraw[0] != Uint.MAX_256 ? intendedWithdraw[0] : balancesFromVault[toLower(tokensToWithdraw[0])]],
        '0x',
        COMPANION_SWAPPER_CONTRACT.address(chainId),
      ] as const;
      const specialWithdrawTx = {
        abi: companionAbi,
        functionName: 'specialWithdraw',
        args: [vault as ViemAddress, ...basicArgs],
      } as const;

      const { result } = await this.providerService.getViemPublicClient({ chainId }).simulateContract({
        abi: vaultAbi,
        address: vault,
        account: caller as ViemAddress,
        functionName: 'specialWithdraw',
        args: basicArgs,
      });
      const [, , actualWithdrawnTokens, actualWithdrawnAmounts] = result;

      calls.push(encodeFunctionData(specialWithdrawTx));

      // Convert farm token to asset or specified token
      withdrawsToConvert.push({
        chainId,
        sellToken: actualWithdrawnTokens[0], // Farm token
        buyToken: withdraw.amounts[0].convertTo ?? withdraw.amounts[0].token, // Asset or token to convert to
        order: { type: 'sell' as const, sellAmount: actualWithdrawnAmounts[0] }, // Amount of farm token to convert
      });
    }

    const withdrawsToTransfer = withdraw.amounts
      .filter(({ type, convertTo, amount }) => !convertTo && type != WithdrawType.MARKET && BigInt(amount) > 0n)
      .map(({ token }) => token);

    const swapAndTransferData = await this.getSwapAndTransferData({
      chainId,
      swaps: { requests: withdrawsToConvert, swapConfig: withdraw.swapConfig },
      transfers: withdrawsToTransfer,
      recipient,
    });

    calls.push(swapAndTransferData);

    // Build multicall and return tx
    return buildCompanionMulticall({ chainId, calls });
  }

  private async getSwapData({
    request,
    leftoverRecipient,
    swapConfig,
  }: {
    request: Pick<QuoteRequest, 'chainId' | 'sellToken' | 'buyToken' | 'order'>;
    leftoverRecipient: Address;
    swapConfig: EarnActionSwapConfig | undefined;
  }) {
    const txValidFor = swapConfig?.txValidFor ?? '1w';
    const { bestQuote, tx } = await this.buildBestQuoteTx({ request, leftoverRecipient, swapConfig });

    const allowanceTargets = isSameAddress(bestQuote.source.allowanceTarget, Addresses.ZERO_ADDRESS)
      ? []
      : [{ token: bestQuote.sellToken.address, target: bestQuote.source.allowanceTarget }];

    // Swap adapter uses the zero address as the native token
    const tokenOutDistribution = isSameAddress(bestQuote.buyToken.address, Addresses.NATIVE_TOKEN)
      ? Addresses.ZERO_ADDRESS
      : bestQuote.buyToken.address;

    const arbitraryCall = this.permit2Service.arbitrary.buildArbitraryCallWithoutPermit({
      allowanceTargets,
      calls: [{ to: tx.to, data: tx.data, value: tx.value ?? 0n }],
      distribution: { [tokenOutDistribution]: [{ recipient: EARN_VAULT_COMPANION.address(request.chainId), shareBps: 0 }] },
      txValidFor,
      chainId: request.chainId,
    });

    const swapData = encodeFunctionData({
      abi: companionAbi,
      functionName: 'runSwap',
      args: [
        Addresses.ZERO_ADDRESS, // No need to set it because we are already transferring the funds to the swapper
        tx.value ?? 0n,
        arbitraryCall.data as Hex,
      ],
    });

    return { bestQuote, swapData };
  }

  private async getSwapAndTransferData({
    chainId,
    swaps: { requests, swapConfig },
    transfers,
    recipient,
  }: {
    chainId: ChainId;
    swaps: { requests: Pick<QuoteRequest, 'chainId' | 'sellToken' | 'buyToken' | 'order'>[]; swapConfig?: EarnActionSwapConfig };
    transfers?: Address[];
    recipient: Address;
  }) {
    const allowanceTargets: Record<TokenAddress, Address> = {};
    const distributions: Record<TokenAddress, { recipient: Address; shareBps: number }[]> = {};

    const promises: Promise<GenericContractCall>[] = requests.map(async (request) => {
      const { bestQuote, tx } = await this.buildBestQuoteTx({ request, leftoverRecipient: recipient, swapConfig });

      if (!isSameAddress(bestQuote.source.allowanceTarget, Addresses.ZERO_ADDRESS)) {
        allowanceTargets[bestQuote.sellToken.address] = bestQuote.source.allowanceTarget;
      }

      // Swap adapter uses the zero address as the native token
      const tokenOutDistribution = isSameAddress(bestQuote.buyToken.address, Addresses.NATIVE_TOKEN)
        ? Addresses.ZERO_ADDRESS
        : bestQuote.buyToken.address;
      distributions[tokenOutDistribution] = [{ recipient, shareBps: 0 }];

      return {
        to: tx.to,
        data: tx.data,
        value: tx.value ?? 0n,
      };
    });

    const calls = await Promise.all(promises);

    // Handle transfers
    if (transfers) {
      for (const transfer of transfers) {
        const tokenOutTransfer = isSameAddress(transfer, Addresses.NATIVE_TOKEN) ? Addresses.ZERO_ADDRESS : transfer;
        distributions[tokenOutTransfer] = [{ recipient, shareBps: 0 }];
      }
    }

    const arbitraryCall = this.permit2Service.arbitrary.buildArbitraryCallWithoutPermit({
      allowanceTargets: Object.entries(allowanceTargets).map(([token, target]) => ({ token, target })),
      calls,
      distribution: distributions,
      txValidFor: swapConfig?.txValidFor ?? '1w',
      chainId,
    });

    const swapData = encodeFunctionData({
      abi: companionAbi,
      functionName: 'runSwap',
      args: [
        Addresses.ZERO_ADDRESS, // No need to set it because we are already transferring the funds to the swapper
        0n,
        arbitraryCall.data as Hex,
      ],
    });

    return swapData;
  }

  private async buildBestQuoteTx({
    request,
    leftoverRecipient,
    swapConfig,
  }: {
    request: Pick<QuoteRequest, 'chainId' | 'sellToken' | 'buyToken' | 'order'>;
    leftoverRecipient: Address;
    swapConfig?: EarnActionSwapConfig;
  }) {
    const bestQuote = await this.quoteService.getBestQuote({
      request: {
        ...request,
        slippagePercentage: swapConfig?.slippagePercentage ?? 0.3,
        takerAddress: COMPANION_SWAPPER_CONTRACT.address(request.chainId),
        recipient: COMPANION_SWAPPER_CONTRACT.address(request.chainId),
        txValidFor: swapConfig?.txValidFor ?? '1w',
        sourceConfig: { custom: { balmy: { leftoverRecipient } } },
      },
      config: {
        timeout: '5s',
      },
    });
    const { [bestQuote.source.id]: tx } = await this.quoteService.buildAllTxs({
      config: { timeout: '5s' },
      quotes: { [bestQuote.source.id]: bestQuote },
      sourceConfig: { custom: { balmy: { leftoverRecipient } } },
    });
    return { bestQuote, tx };
  }

  private async checkIfNeedsSwap({ chainId, strategyId, depositToken }: { chainId: ChainId; strategyId: bigint; depositToken: Address }) {
    // Get the strategy from the strategy registry
    const strategy = await this.providerService.getViemPublicClient({ chainId }).readContract({
      abi: strategyRegistryAbi,
      address: EARN_STRATEGY_REGISTRY.address(chainId),
      functionName: 'getStrategy',
      args: [strategyId],
    });

    // Check if the deposit token is supported by the strategy and get the asset
    const [asset, isDepositTokenSupported] = await this.providerService.getViemPublicClient({ chainId }).multicall({
      contracts: [
        { abi: strategyAbi, address: strategy, functionName: 'asset' },
        {
          abi: strategyAbi,
          address: strategy,
          functionName: 'isDepositTokenSupported',
          args: [depositToken as ViemAddress],
        },
      ],
      allowFailure: false,
      multicallAddress: MULTICALL_CONTRACT.address(chainId),
      batchSize: 0,
    });

    return { needsSwap: !isDepositTokenSupported, asset };
  }
}

function buildPermissionPermit(positionId: bigint, permit: EarnPermissionPermit, vault: Address): Hex {
  return encodeFunctionData({
    abi: companionAbi,
    functionName: 'permissionPermit',
    args: [
      vault as ViemAddress,
      permit.permissions.map(({ operator, permissions }) => ({
        positionId,
        permissionSets: [
          {
            operator: operator as Hex,
            permissions: permissions.map(mapPermission),
          },
        ],
      })),
      BigInt(permit.deadline),
      permit.signature,
    ],
  });
}

export function mapPermission(permission: EarnPermission) {
  switch (permission) {
    case EarnPermission.INCREASE:
      return 0;
    case EarnPermission.WITHDRAW:
      return 1;
  }
}

function buildTakeFromCallerWithPermit(
  { token, amount, nonce, deadline }: PermitData['permitData'],
  signature: string,
  recipient: Address
): Hex {
  return encodeFunctionData({
    abi: companionAbi,
    functionName: 'permitTakeFromCaller',
    args: [token as ViemAddress, BigInt(amount), BigInt(nonce), BigInt(deadline), signature as Hex, recipient as ViemAddress],
  });
}

function buildTakeFromCaller(token: TokenAddress, amount: BigIntish, recipient: Address): Hex {
  return encodeFunctionData({
    abi: companionAbi,
    functionName: 'takeFromCaller',
    args: [token as ViemAddress, BigInt(amount), recipient as ViemAddress],
  });
}

async function buildCompanionMulticall({ chainId, calls, value }: { chainId: ChainId; calls: Hex[]; value?: bigint }) {
  const data = encodeFunctionData({
    abi: companionAbi,
    functionName: 'multicall',
    args: [calls],
  });
  return { to: EARN_VAULT_COMPANION.address(chainId), data, value };
}

function fulfillStrategy(
  strategyResponse: StrategyResponse | (StrategyResponse & HistoricalData),
  tokens: Record<TokenAddress, Token>,
  guardians: Record<GuardianId, Guardian>
): Strategy {
  const {
    farm: { rewards, asset, ...restFarm },
    guardian,
    depositTokens,
    ...restStrategyResponse
  } = strategyResponse;
  return {
    ...{
      ...restStrategyResponse,
      depositTokens: depositTokens.map((token) => ({
        ...tokens[token],
        address: token,
        type: isSameAddress(token, asset.address) ? 'asset' : 'farm',
      })),
      farm: {
        ...restFarm,
        asset: { ...tokens[asset.address], address: asset.address, withdrawTypes: asset.withdrawTypes },
        rewards: rewards
          ? {
              tokens: rewards.tokens.map((token) => ({ ...tokens[token.address], address: token.address, withdrawTypes: token.withdrawTypes })),
              apy: rewards.apy,
            }
          : undefined,
      },
      guardian: guardian ? { ...guardians[guardian.id], ...guardian } : undefined,
    },
  };
}

function fulfillHistory(action: EarnPositionAction, asset: TokenAddress, tokens: Record<TokenAddress, Token>) {
  switch (action.action) {
    case 'created':
    case 'increased':
      return {
        ...action,
        deposited: toAmountsOfToken({
          price: action.assetPrice,
          amount: action.deposited,
          decimals: tokens[asset].decimals,
        }),
      };
    case 'withdrawn':
      return {
        ...action,
        withdrawn: action.withdrawn.map(({ token, amount, tokenPrice, withdrawType }) => ({
          token: { ...tokens[token], address: token, price: tokenPrice },
          amount: toAmountsOfToken({
            price: tokenPrice,
            amount,
            decimals: tokens[token].decimals,
          }),
          withdrawType,
        })),
      };
    case 'transferred':
    case 'modified permissions':
      return action;
    case 'delayed withdrawal claimed':
      return {
        ...action,
        token: { ...tokens[action.token], address: action.token },
        withdrawn: toAmountsOfToken({
          price: action.tokenPrice,
          amount: action.withdrawn,
          decimals: tokens[action.token].decimals,
        }),
      };
  }
}

function fulfillHistoricalBalance({ timestamp, balances }: HistoricalBalance, tokens: Record<TokenAddress, Token>) {
  return {
    timestamp,
    balances: fulfillBalance(balances, tokens),
  };
}

function fulfillBalance(balances: { token: TokenAddress; amount: bigint; profit: bigint }[], tokens: Record<TokenAddress, Token>) {
  return balances.map(({ token, amount, profit }) => ({
    token: { ...tokens[token], address: token },
    amount: toAmountsOfToken({
      price: tokens[token].price,
      amount,
      decimals: tokens[token].decimals,
    }),
    profit: toAmountsOfToken({
      price: tokens[token].price,
      amount: profit,
      decimals: tokens[token].decimals,
    }),
  }));
}

type GetStrategyResponse = {
  strategy: StrategyResponse & HistoricalData;
  tokens: Record<ViemAddress, Token>;
};

type GetSupportedStrategiesResponse = {
  strategiesByNetwork: Record<ChainId, StrategiesResponse>;
  guardians: Record<GuardianId, Guardian>;
};

type StrategiesResponse = {
  strategies: StrategyResponse[];
  tokens: Record<ViemAddress, Token>;
};

type StrategyResponse = {
  id: StrategyId;
  farm: StrategyFarmResponse;
  depositTokens: ViemAddress[];
  guardian?: StrategyGuardian;
  tos?: string;
  riskLevel?: StrategyRiskLevel;
};

type StrategyFarmResponse = {
  id: FarmId;
  chainId: ChainId;
  name: string;
  asset: { address: ViemAddress; withdrawTypes: WithdrawType[] };
  rewards?: { tokens: { address: ViemAddress; withdrawTypes: WithdrawType[] }[]; apy: number };
  tvl: number;
  type: StrategyYieldType;
  apy: number;
};

type GetPositionsResponse = {
  positionsByNetwork: Record<ChainId, PositionsResponse>;
  guardians: Record<GuardianId, Guardian>;
};

type PositionsResponse = {
  positions: EarnPositionResponse[];
  tokens: Record<ViemAddress, Token>;
  strategies: Record<StrategyId, StrategyResponse>;
};

type EarnPositionResponse = {
  id: PositionId;
  createdAt: Timestamp;
  owner: ViemAddress;
  permissions: EarnPermissions;
  strategyId: StrategyId;
  balances: { token: ViemAddress; amount: bigint; profit: bigint }[];
  delayed?: DelayedWithdrawalResponse[];
  history?: EarnPositionAction[];
  historicalBalances?: HistoricalBalance[];
};
type DelayedWithdrawalResponse = { token: ViemAddress; pending: bigint; ready: bigint };

type HistoricalBalance = {
  timestamp: Timestamp;
  balances: { token: ViemAddress; amount: bigint; profit: bigint }[];
};

type EarnPositionAction = { tx: Transaction } & ActionType;
type Transaction = {
  hash: string;
  timestamp: Timestamp;
};

type ActionType =
  | CreatedAction
  | IncreasedAction
  | WithdrawnAction
  | TransferredAction
  | PermissionsModifiedAction
  | DelayedWithdrawalClaimedAction;

type CreatedAction = {
  action: 'created';
  owner: ViemAddress;
  strategyId: StrategyId;
  permissions: EarnPermissions;
  deposited: bigint;
  assetPrice?: number;
};

type IncreasedAction = {
  action: 'increased';
  deposited: bigint;
  assetPrice?: number;
};

type WithdrawnAction = {
  action: 'withdrawn';
  withdrawn: {
    token: ViemAddress;
    amount: bigint;
    tokenPrice?: number;
    withdrawType: WithdrawType;
  }[];
  recipient: ViemAddress;
};

type TransferredAction = {
  action: 'transferred';
  from: ViemAddress;
  to: ViemAddress;
};

type PermissionsModifiedAction = {
  action: 'modified permissions';
  permissions: EarnPermissions;
};

type DelayedWithdrawalClaimedAction = {
  action: 'delayed withdrawal claimed';
  token: ViemAddress;
  withdrawn: bigint;
  tokenPrice?: number;
  recipient: ViemAddress;
};

type BaseGetPositionsParams = {
  chains?: ChainId[];
  includeHistory?: boolean;
  includeHistoricalBalancesFrom?: Timestamp;
  config?: { timeout?: TimeString };
};

type GetPositionsParams = BaseGetPositionsParams &
  (
    | {
        ids: ArrayOneOrMore<PositionId>;
      }
    | {
        accounts: ArrayOneOrMore<Address>;
      }
  );
