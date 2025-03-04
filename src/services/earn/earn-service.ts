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
  Fee,
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
  EarnStrategyStatus,
  StrategyYieldType,
  Token,
  TYPES,
  WithdrawEarnPositionParams,
  WithdrawType,
  MigrateEarnType,
  MigrateEarnPositionParams,
  MigrationCode,
} from './types';
import {
  COMPANION_SWAPPER_CONTRACT,
  DELAYED_WITHDRAWAL_MANAGER,
  EARN_STRATEGY_ROUTER,
  EARN_VAULT,
  EARN_VAULT_COMPANION,
  EXTERNAL_FIREWALL,
} from './config';
import {
  decodeAbiParameters,
  decodeFunctionResult,
  encodeFunctionData,
  Hex,
  parseAbiParameters,
  toFunctionSelector,
  toHex,
  Address as ViemAddress,
  encodeAbiParameters,
} from 'viem';
import vaultAbi from '@shared/abis/earn-vault';
import companionAbi from '@shared/abis/earn-vault-companion';
import strategyRouterAbi from '@shared/abis/earn-strategy-router';
import strategyAbi from '@shared/abis/earn-strategy';
import delayerWithdrawalManagerAbi from '@shared/abis/earn-delayed-withdrawal-manager';
import { calculateDeadline, isSameAddress, toAmountsOfToken, toLower } from '@shared/utils';
import { Addresses, Uint } from '@shared/constants';
import { IPermit2Service, PermitData, SinglePermitParams } from '@services/permit2';
import { IQuoteService, QuoteRequest, QuoteResponseWithTx } from '@services/quotes';
import { IProviderService } from '@services/providers';
import { MULTICALL_CONTRACT } from '@services/providers/utils';
import { IAllowanceService } from '@services/allowances';
import { PERMIT2_CONTRACT } from '@services/permit2/utils/config';
import qs from 'qs';
import { IFetchService } from '@services/fetch';
import { ArrayOneOrMore } from '@utility-types';
import permit2AdapterAbi from '@shared/abis/permit2-adapter';
import { IBalanceService } from '@services/balances';
export class EarnService implements IEarnService {
  constructor(
    private readonly apiUrl: string,
    private readonly permit2Service: IPermit2Service,
    private readonly quoteService: IQuoteService,
    private readonly providerService: IProviderService,
    private readonly allowanceService: IAllowanceService,
    private readonly fetchService: IFetchService,
    private readonly balanceService: IBalanceService
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
          lastUpdatedAt: position.lastUpdatedAt,
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
    const strategyRouter = EARN_STRATEGY_ROUTER.address(chainId);
    const [, strategyRegistry, strategyIdString] = strategyId.split('-');
    const { result: supportedDepositTokensEncoded } = await this.providerService.getViemPublicClient({ chainId }).simulateContract({
      abi: strategyRouterAbi,
      address: strategyRouter,
      functionName: 'routeByStrategyId',
      args: [strategyRegistry as ViemAddress, BigInt(strategyIdString), SUPPORTED_DEPOSIT_TOKENS_DATA],
    });
    const supportedDepositTokens = decodeFunctionResult({
      abi: strategyAbi,
      functionName: 'supportedDepositTokens',
      data: supportedDepositTokensEncoded,
    });
    const needsSwap = !supportedDepositTokens.map(toLower).includes(toLower(depositWith));
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
    deposit,
    caller,
  }: CreateEarnPositionParams): Promise<BuiltTransaction> {
    const vault = EARN_VAULT.address(chainId);
    const companion = EARN_VAULT_COMPANION.address(chainId);
    const strategyRouter = EARN_STRATEGY_ROUTER.address(chainId);
    let depositInfo: { token: Address; amount: bigint; value: bigint };
    if ('token' in deposit) {
      const amount = BigInt(deposit.amount);
      depositInfo = { token: deposit.token, amount, value: isSameAddress(deposit.token, Addresses.NATIVE_TOKEN) ? amount : 0n };
    } else {
      depositInfo = { token: deposit.permitData.token, amount: BigInt(deposit.permitData.amount), value: 0n };
    }
    const [, strategyRegistry, strategyIdString] = strategyId.split('-');
    const strategyIdBigInt = BigInt(strategyIdString);

    const [assetEncoded, supportedDepositTokensEncoded] = await this.providerService.getViemPublicClient({ chainId }).multicall({
      contracts: [
        {
          abi: strategyRouterAbi,
          address: strategyRouter,
          functionName: 'routeByStrategyId',
          args: [strategyRegistry as ViemAddress, strategyIdBigInt, ASSET_DATA],
        },
        {
          abi: strategyRouterAbi,
          address: strategyRouter,
          functionName: 'routeByStrategyId',
          args: [strategyRegistry as ViemAddress, strategyIdBigInt, SUPPORTED_DEPOSIT_TOKENS_DATA],
        },
      ],
      allowFailure: false,
      multicallAddress: MULTICALL_CONTRACT.address(chainId),
    });
    const asset = decodeFunctionResult({ abi: strategyAbi, functionName: 'asset', data: assetEncoded });
    const supportedDepositTokens = decodeFunctionResult({
      abi: strategyAbi,
      functionName: 'supportedDepositTokens',
      data: supportedDepositTokensEncoded,
    });
    const needsSwap = !supportedDepositTokens.map(toLower).includes(toLower(depositInfo.token));

    if ('token' in deposit && !needsSwap) {
      // If don't need to use Permit2, then just call the vault
      const tx = {
        to: vault,
        data: encodeFunctionData({
          abi: vaultAbi,
          functionName: 'createPosition',
          args: [
            strategyIdBigInt,
            depositInfo.token as ViemAddress,
            depositInfo.amount,
            owner as ViemAddress,
            permissions.map(({ operator, permissions }) => ({
              operator: operator as ViemAddress,
              permissions: permissions.map(mapPermission),
            })),
            strategyValidationData ?? '0x',
            '0x',
          ],
        }),
        value: depositInfo.value,
      };
      return this.buildAttestedCallIfActivated(tx, caller, chainId, getSelectorFromAbi(vaultAbi, 'createPosition'));
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
        previousCalls: calls,
        caller,
      }).then((result) => calls.push(result.tx));
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
          strategyIdBigInt,
          depositToken,
          Uint.MAX_256,
          owner as ViemAddress,
          permissions.map(({ operator, permissions }) => ({
            operator: operator as ViemAddress,
            permissions: permissions.map(mapPermission),
          })),
          strategyValidationData ?? '0x',
          '0x',
          maxApprove,
        ],
      })
    );

    // Build multicall and return tx
    return this.buildCompanionMulticall({
      chainId,
      calls,
      value: depositInfo.value,
      caller,
      needsAttestation: true,
      method: getSelectorFromAbi(vaultAbi, 'createPosition'),
    });
  }

  async buildIncreasePositionTx({
    chainId,
    positionId,
    increase,
    permissionPermit,
    caller,
  }: IncreaseEarnPositionParams): Promise<BuiltTransaction> {
    const vault = EARN_VAULT.address(chainId);
    const companion = EARN_VAULT_COMPANION.address(chainId);
    const strategyRouter = EARN_STRATEGY_ROUTER.address(chainId);
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

    const [assetEncoded, supportedDepositTokensEncoded, positionOwner] = await this.providerService.getViemPublicClient({ chainId }).multicall({
      contracts: [
        { abi: strategyRouterAbi, address: strategyRouter, functionName: 'routeByPositionId', args: [vault, bigIntPositionId, ASSET_DATA] },
        {
          abi: strategyRouterAbi,
          address: strategyRouter,
          functionName: 'routeByPositionId',
          args: [vault, bigIntPositionId, SUPPORTED_DEPOSIT_TOKENS_DATA],
        },
        { abi: vaultAbi, address: vault, functionName: 'ownerOf', args: [bigIntPositionId] },
      ],
      allowFailure: false,
      multicallAddress: MULTICALL_CONTRACT.address(chainId),
    });
    const asset = decodeFunctionResult({ abi: strategyAbi, functionName: 'asset', data: assetEncoded });
    const supportedDepositTokens = decodeFunctionResult({
      abi: strategyAbi,
      functionName: 'supportedDepositTokens',
      data: supportedDepositTokensEncoded,
    });
    const needsSwap = !supportedDepositTokens.map(toLower).includes(toLower(increaseInfo.token));

    if ('token' in increase && !needsSwap) {
      // If don't need to use Permit2, then just call the vault
      const tx = {
        to: vault,
        data: encodeFunctionData({
          abi: vaultAbi,
          functionName: 'increasePosition',
          args: [bigIntPositionId, increaseInfo.token as ViemAddress, increaseInfo.amount],
        }),
        value: increaseInfo.value,
      };
      return this.buildAttestedCallIfActivated(tx, caller, chainId, getSelectorFromAbi(vaultAbi, 'increasePosition'));
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
        previousCalls: calls,
        caller,
      }).then((result) => calls.push(result.tx));
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
        args: [vault as ViemAddress, bigIntPositionId, depositToken, Uint.MAX_256, maxApprove],
      })
    );

    // Build multicall and return tx
    return this.buildCompanionMulticall({
      chainId,
      calls,
      value: increaseInfo.value,
      caller,
      needsAttestation: true,
      method: getSelectorFromAbi(vaultAbi, 'increasePosition'),
    });
  }

  async buildClaimDelayedWithdrawPositionTx({
    chainId,
    positionId,
    recipient,
    permissionPermit,
    claim,
    caller,
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
      recipient: caller,
    }));

    // Handle swaps
    const swapAndTransferData = await this.getSwapAndTransferData({
      chainId,
      swaps: {
        requests: withdrawsToConvert,
        swapConfig: claim.swapConfig,
      },
      recipient,
      previousCalls: calls,
      caller,
    });

    calls.push(...swapAndTransferData.calls);

    // Build multicall and return tx
    return this.buildCompanionMulticall({ chainId, calls, needsAttestation: false });
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
    const strategyRouter = EARN_STRATEGY_ROUTER.address(chainId);
    const [, , tokenId] = positionId.split('-');
    const bigIntPositionId = BigInt(tokenId);
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
    const calldata = encodeFunctionData({
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
    const [specialWithdrawEncoded, [, strategyAddress]] = await this.providerService.getViemPublicClient({ chainId }).multicall({
      contracts: [
        {
          abi: strategyRouterAbi,
          address: strategyRouter,
          functionName: 'routeByPositionId',
          args: [vault, bigIntPositionId, calldata],
        },
        {
          address: vault,
          abi: vaultAbi,
          functionName: 'positionsStrategy',
          args: [bigIntPositionId],
        },
      ],
      allowFailure: false,
      multicallAddress: MULTICALL_CONTRACT.address(chainId),
    });
    const result = decodeFunctionResult({ abi: strategyAbi, functionName: 'specialWithdraw', data: specialWithdrawEncoded });

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
    migrate,
    recipient,
    caller,
    permissionPermit,
  }: WithdrawEarnPositionParams): Promise<BuiltTransaction> {
    const vault = EARN_VAULT.address(chainId);
    const [, , tokenId] = positionId.split('-');
    const bigIntPositionId = BigInt(tokenId);
    const tokensToWithdraw = withdraw.amounts.map(({ token }) => token as ViemAddress);
    const intendedWithdraw = Object.fromEntries(withdraw.amounts.map(({ token, amount }) => [toLower(token), BigInt(amount)]));
    const tokensToMigrate = migrate?.amounts?.filter(({ amount }) => BigInt(amount) > 0n)?.map(({ token }) => token as ViemAddress) ?? [];
    const intendedMigrate = migrate ? Object.fromEntries(migrate.amounts.map(({ token, amount }) => [toLower(token), BigInt(amount)])) : {};

    if (withdraw.amounts.some(({ convertTo, type }) => !!convertTo && type == WithdrawType.DELAYED)) {
      throw new Error('Can not convert delayed withdrawals');
    }
    const shouldConvertAnyToken = withdraw.amounts.some(({ convertTo, amount }) => !!convertTo && BigInt(amount) > 0n);
    const marketWithdrawalsTypes = withdraw.amounts.filter(({ type }) => type == WithdrawType.MARKET);
    const shouldWithdrawFarmToken = marketWithdrawalsTypes.length > 0;
    const shouldMigrate = tokensToMigrate.length > 0;
    if (marketWithdrawalsTypes.length > 1 || (shouldWithdrawFarmToken && withdraw.amounts[0].type != WithdrawType.MARKET)) {
      throw new Error('Only one withdraw type MARKET is allowed, and it should be the first one');
    }
    if (!shouldConvertAnyToken && !shouldWithdrawFarmToken && !shouldMigrate) {
      // If don't need to convert or migrate anything, then just call the vault
      const tx = {
        to: vault,
        data: encodeFunctionData({
          abi: vaultAbi,
          functionName: 'withdraw',
          args: [BigInt(bigIntPositionId), tokensToWithdraw, Object.values(intendedWithdraw), recipient as ViemAddress],
        }),
      };

      return this.buildAttestedCallIfActivated(tx, caller, chainId, getSelectorFromAbi(vaultAbi, 'withdraw'));
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
            Object.values(intendedWithdraw).map((amount, index) => (withdraw.amounts[index].type != WithdrawType.MARKET ? amount : 0n)),
            shouldMigrate ? EARN_VAULT_COMPANION.address(chainId) : COMPANION_SWAPPER_CONTRACT.address(chainId),
          ],
        })
      );
    }

    let balancesFromVault: Record<TokenAddress, bigint> = {};
    // If any token amount to convert is MAX_UINT256 or we are withdrawing the farm token, then we need to check vault balance
    if (
      shouldWithdrawFarmToken ||
      withdraw.amounts.some(({ amount }) => amount == Uint.MAX_256) ||
      migrate?.amounts?.some(({ amount }) => amount == Uint.MAX_256)
    ) {
      const [positionTokens, positionBalances] = await this.providerService.getViemPublicClient({ chainId }).readContract({
        abi: vaultAbi,
        address: vault,
        functionName: 'position',
        args: [bigIntPositionId],
      });
      balancesFromVault = Object.fromEntries(positionTokens.map((token, index) => [toLower(token), positionBalances[index]]));
    }

    // Calculate real amounts
    const realWithdrawAmounts = Object.fromEntries(
      withdraw.amounts.map(({ token, amount }) => [toLower(token), BigInt(amount != Uint.MAX_256 ? amount : balancesFromVault[token])])
    );
    const realMigrateAmounts = Object.fromEntries(
      withdraw.amounts.map(({ token }) => [
        toLower(token),
        intendedMigrate?.[token] ? BigInt(intendedMigrate[token] != Uint.MAX_256 ? intendedMigrate[token] : realWithdrawAmounts[token]) : 0n,
      ])
    );
    const realConvertAmounts = withdraw.amounts.reduce((acc, { token, convertTo }) => {
      const convertAmount = realWithdrawAmounts[token] - realMigrateAmounts[token];
      if (!!convertTo && convertAmount > 0n) {
        acc[toLower(token)] = convertAmount;
      }
      return acc;
    }, {} as Record<TokenAddress, bigint>);
    const realTransferAmounts = withdraw.amounts.reduce((acc, { token, type, convertTo }) => {
      const transferAmount = realWithdrawAmounts[token] - realMigrateAmounts[token];
      if (!convertTo && transferAmount > 0n && type != WithdrawType.MARKET) {
        acc[toLower(token)] = transferAmount;
      }
      return acc;
    }, {} as Record<TokenAddress, bigint>);

    // Handle swaps
    const withdrawsToConvert = withdraw.amounts
      .filter(({ token }) => realConvertAmounts[token] > 0n)
      .map(({ token, convertTo }) => ({
        chainId,
        sellToken: token as ViemAddress,
        buyToken: convertTo! as ViemAddress,
        order: { type: 'sell' as const, sellAmount: realConvertAmounts[token] },
        recipient: caller,
      }));

    let migrationAsset: ViemAddress;
    if (shouldMigrate) {
      migrationAsset = await this.getStrategyAsset({ chainId, ...migrate! });
      withdrawsToConvert.push(
        ...Object.entries(realMigrateAmounts)
          .filter(([token]) => !isSameAddress(token, migrationAsset) && realMigrateAmounts[token] > 0n)
          .map(([token, amount]) => ({
            chainId,
            sellToken: token as ViemAddress,
            buyToken: migrationAsset,
            order: { type: 'sell' as const, sellAmount: amount },
            recipient: EARN_VAULT_COMPANION.address(chainId),
          }))
      );
    }

    // Check circular swaps
    const convertToSet = new Set(withdrawsToConvert.map(({ buyToken }) => buyToken));
    const convertFromSet = new Set(withdrawsToConvert.map(({ sellToken }) => sellToken));
    const isCircularConversion = [...convertToSet].find((to) => convertFromSet.has(to));
    if (isCircularConversion) {
      throw new Error('Cannot make a circular swap');
    }

    // Handle special withdraw
    if (shouldWithdrawFarmToken) {
      const token = toLower(tokensToWithdraw[0]);
      const basicArgs = [
        bigIntPositionId,
        BigInt(SpecialWithdrawalCode.WITHDRAW_ASSET_FARM_TOKEN_BY_ASSET_AMOUNT),
        [realWithdrawAmounts[token]],
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
        buyToken: (withdraw.amounts[0].convertTo ?? withdraw.amounts[0].token) as ViemAddress, // Asset or token to convert to
        order: { type: 'sell' as const, sellAmount: actualWithdrawnAmounts[0] }, // Amount of farm token to convert
        recipient: caller,
      });
    }

    if (shouldMigrate) {
      const tokensToRecipientWithoutMigrate = withdraw.amounts.filter(({ token }) => realTransferAmounts[token] > 0n).map(({ token }) => token);
      if (tokensToRecipientWithoutMigrate.length > 0) {
        calls.push(
          ...tokensToRecipientWithoutMigrate.map((token) =>
            encodeFunctionData({
              abi: companionAbi,
              functionName: 'sendToRecipient',
              args: [token as ViemAddress, realTransferAmounts[token], recipient as ViemAddress],
            })
          )
        );
      }

      calls.push(
        ...withdrawsToConvert.map(({ sellToken, order }) =>
          encodeFunctionData({
            abi: companionAbi,
            functionName: 'sendToRecipient',
            args: [sellToken, order.sellAmount, COMPANION_SWAPPER_CONTRACT.address(chainId) as ViemAddress],
          })
        )
      );
    }

    const tokensToTransfer = !shouldMigrate
      ? withdraw.amounts.filter(({ token }) => realTransferAmounts[token] > 0n).map(({ token }) => token)
      : [];

    if (tokensToTransfer.length > 0 || withdrawsToConvert.length > 0) {
      const swapAndTransferData = await this.getSwapAndTransferData({
        chainId,
        swaps: { requests: withdrawsToConvert, swapConfig: withdraw.swapConfig },
        transfers: tokensToTransfer,
        recipient,
        previousCalls: calls,
        caller,
      });

      calls.push(...swapAndTransferData.calls);
    }

    if (shouldMigrate) {
      const migrateTx = this.buildMigrateTransaction({
        migrate: migrate!,
        caller,
        vault,
        migrationAsset: migrationAsset!,
        fromPositionId: positionId,
      });
      calls.push(migrateTx);
    }

    // Build multicall and return tx
    return this.buildCompanionMulticall({
      chainId,
      calls,
      caller,
      needsAttestation: true,
      method: getSelectorFromAbi(vaultAbi, 'withdraw'),
    });
  }

  private async getSwapData({
    request,
    leftoverRecipient,
    swapConfig,
    previousCalls,
    caller,
  }: {
    request: Pick<QuoteRequest, 'chainId' | 'sellToken' | 'buyToken' | 'order'>;
    leftoverRecipient: Address;
    swapConfig: EarnActionSwapConfig | undefined;
    previousCalls: Hex[];
    caller: Address;
  }) {
    const txValidFor = swapConfig?.txValidFor ?? '1w';
    const [quotes, balances] = await Promise.all([
      this.buildQuotes({ request, leftoverRecipient, swapConfig }),
      this.balanceService.getBalancesForAccountInChain({
        account: caller,
        chainId: request.chainId,
        tokens: [Addresses.NATIVE_TOKEN],
      }),
    ]);
    const nativeBalance = balances[Addresses.NATIVE_TOKEN] ?? 0n;
    const bestQuote = await this.simulateSwaps({
      request,
      txValidFor,
      quotes,
      nativeBalance,
      previousCalls,
      recipient: EARN_VAULT_COMPANION.address(request.chainId),
      caller,
    });
    return { quote: bestQuote.quote, tx: bestQuote.tx };
  }

  private buildMigrateTransaction(params: {
    migrate: MigrateEarnPositionParams;
    migrationAsset: ViemAddress;
    caller: Address;
    vault: ViemAddress;
    fromPositionId: PositionId;
  }) {
    const { migrate, migrationAsset, caller, vault, fromPositionId } = params;
    if (migrate?.type == MigrateEarnType.CREATE) {
      const strategyIdBigInt = BigInt(migrate.strategyId.split('-')[2]);
      const misc: Record<number, Hex> = {
        [MigrationCode.MIGRATE_FROM_POSITION_AND_CREATE]: encodeAbiParameters(parseAbiParameters('string'), [fromPositionId]),
      };
      // Handle deposit
      return encodeFunctionData({
        abi: companionAbi,
        functionName: 'createPosition',
        args: [
          vault,
          strategyIdBigInt,
          migrationAsset!,
          Uint.MAX_256,
          caller as ViemAddress,
          migrate?.permissions.map(({ operator, permissions }) => ({
            operator: operator as ViemAddress,
            permissions: permissions.map(mapPermission),
          })),
          migrate.strategyValidationData ?? '0x',
          encodeAbiParameters(parseAbiParameters('(uint256, bytes)[]'), [
            Object.entries(misc).map(([key, value]) => [BigInt(key), value] as const),
          ]),
          false,
        ],
      });
    } else if (migrate?.type == MigrateEarnType.INCREASE) {
      // Handle increase
      const positionId = BigInt(migrate.positionId.split('-')[2]);
      return encodeFunctionData({
        abi: companionAbi,
        functionName: 'increasePosition',
        args: [vault as ViemAddress, positionId, migrationAsset!, Uint.MAX_256, false],
      });
    }
    throw new Error('Invalid migration type');
  }

  private async getSwapAndTransferData({
    chainId,
    swaps: { requests, swapConfig },
    transfers,
    recipient,
    previousCalls,
    caller,
  }: {
    chainId: ChainId;
    swaps: {
      requests: (Pick<QuoteRequest, 'chainId' | 'sellToken' | 'buyToken' | 'order'> & { recipient: Address })[];
      swapConfig?: EarnActionSwapConfig;
    };
    transfers?: Address[];
    recipient: Address;
    previousCalls: Hex[];
    caller: Address;
  }) {
    const distributions: Record<TokenAddress, { recipient: Address; shareBps: number }[]> = {};

    const promises = requests.map(async (request) => {
      const [quotes, balances] = await Promise.all([
        this.buildQuotes({ request, leftoverRecipient: recipient, swapConfig }),
        this.balanceService.getBalancesForAccountInChain({
          account: caller,
          chainId: request.chainId,
          tokens: [Addresses.NATIVE_TOKEN],
        }),
      ]);
      const nativeBalance = balances[Addresses.NATIVE_TOKEN] ?? 0n;
      const bestQuote = await this.simulateSwaps({
        request,
        txValidFor: swapConfig?.txValidFor ?? '1w',
        quotes,
        nativeBalance,
        previousCalls,
        recipient: request.recipient,
        caller,
      });
      return { quote: bestQuote.quote, tx: bestQuote.tx };
    });

    const bestQuotes = await Promise.all(promises);
    const calls = bestQuotes.map(({ tx }) => tx);
    const value = bestQuotes.reduce((acc, { quote }) => acc + BigInt(quote.tx.value ?? 0), 0n);
    // Handle transfers
    if (transfers?.length) {
      for (const transfer of transfers) {
        const tokenOutTransfer = isSameAddress(transfer, Addresses.NATIVE_TOKEN) ? Addresses.ZERO_ADDRESS : transfer;
        distributions[tokenOutTransfer] = [{ recipient, shareBps: 0 }];
      }

      const arbitraryCall = this.permit2Service.arbitrary.buildArbitraryCallWithoutPermit({
        calls: [],
        distribution: distributions,
        txValidFor: swapConfig?.txValidFor ?? '1w',
        chainId,
      });

      const runSwapData = encodeFunctionData({
        abi: companionAbi,
        functionName: 'runSwap',
        args: [
          Addresses.ZERO_ADDRESS, // No need to set it because we are already transferring the funds to the swapper
          value,
          arbitraryCall.data as Hex,
        ],
      });
      calls.push(runSwapData);
    }

    return { calls, quotes: bestQuotes };
  }
  private async simulateSwaps({
    request,
    txValidFor,
    quotes,
    nativeBalance,
    previousCalls,
    caller,
    recipient,
  }: {
    request: Pick<QuoteRequest, 'chainId' | 'sellToken' | 'buyToken' | 'order'>;
    txValidFor: TimeString;
    quotes: QuoteResponseWithTx<Record<string, any>>[];
    nativeBalance: bigint;
    previousCalls: Hex[];
    caller: Address;
    recipient: Address;
  }) {
    const swapsTx = quotes.map((quote) => {
      // Swap adapter uses the zero address as the native token
      const tokenInDistribution = isSameAddress(quote.sellToken.address, Addresses.NATIVE_TOKEN)
        ? Addresses.ZERO_ADDRESS
        : quote.sellToken.address;
      const tokenOutDistribution = isSameAddress(quote.buyToken.address, Addresses.NATIVE_TOKEN)
        ? Addresses.ZERO_ADDRESS
        : quote.buyToken.address;

      const sellOrderSwapData = encodeFunctionData({
        abi: permit2AdapterAbi,
        functionName: 'sellOrderSwap',
        args: [
          {
            deadline: BigInt(calculateDeadline(txValidFor) ?? calculateDeadline('1w')),
            tokenIn: tokenInDistribution as ViemAddress,
            amountIn: BigInt(quote.sellAmount.amount),
            nonce: 0n,
            signature: '0x' as Hex,
            allowanceTarget: quote.source.allowanceTarget as ViemAddress,
            swapper: quote.tx.to as ViemAddress,
            swapData: quote.tx.data as Hex,
            tokenOut: tokenOutDistribution as ViemAddress,
            minAmountOut: BigInt(quote.minBuyAmount.amount),
            transferOut: [{ recipient: recipient as ViemAddress, shareBps: 0n }],
            misc: '0x',
          },
        ],
      });

      return encodeFunctionData({
        abi: companionAbi,
        functionName: 'runSwap',
        args: [
          Addresses.ZERO_ADDRESS, // No need to set it because we are already transferring the funds to the swapper
          quote.tx.value ?? 0n,
          sellOrderSwapData,
        ],
      });
    });

    const multicallsToSimulate = await Promise.all(
      swapsTx.map(
        async (tx, index) =>
          await this.buildCompanionMulticall({
            chainId: request.chainId,
            calls: [...previousCalls, tx],
            value: quotes[index].tx.value ?? 0n,
            needsAttestation: false,
          }).then(({ data }) => data as Hex)
      )
    );

    const value = quotes.sort((a, b) => Number(b.tx.value ?? 0n) - Number(a.tx.value ?? 0n))[0].tx.value ?? 0n;
    const { result } = await this.providerService.getViemPublicClient({ chainId: request.chainId }).simulateContract({
      abi: companionAbi,
      address: EARN_VAULT_COMPANION.address(request.chainId),
      functionName: 'simulate',
      args: [multicallsToSimulate],
      value: value > nativeBalance ? nativeBalance : value,
      account: caller as ViemAddress,
      // We have to override this to avoid attest the call to the external firewall
      stateOverride: [
        {
          address: '0x0000000000000000000000000000000000f01274',
          code: '0x10', // Random value, it needs to be a non-zero value
        },
      ],
    });

    const decodedResults = result.map(({ success, result, gasSpent }, index) => {
      const [amountIn, amountOut] = success ? decodeAbiParameters(parseAbiParameters('uint256 amountIn, uint256 amountOut'), result) : [0n, 0n];
      return { success, gasSpent, amountIn, amountOut, rawResult: result, tx: swapsTx[index], quote: quotes[index] };
    });

    // DISCLAIMER: We only sort the quotes by amountOut because we don't have buy orders. In the future, if we add buy orders, we should change this.
    const successfulQuotes = decodedResults.filter(({ success }) => success).sort((a, b) => Number(b.amountOut - a.amountOut));
    if (successfulQuotes.length === 0) {
      throw new Error('No successful quotes');
    }
    return { quote: successfulQuotes[0].quote, tx: successfulQuotes[0].tx };
  }
  private async buildQuotes({
    request,
    leftoverRecipient,
    swapConfig,
  }: {
    request: Pick<QuoteRequest, 'chainId' | 'sellToken' | 'buyToken' | 'order'>;
    leftoverRecipient: Address;
    swapConfig?: EarnActionSwapConfig;
  }) {
    const quotes = await this.quoteService.getAllQuotesWithTxs({
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

    return quotes;
  }

  private async buildCompanionMulticall({
    chainId,
    calls,
    value,
    ...rest
  }: { chainId: ChainId; calls: Hex[]; value?: bigint } & (
    | { caller: Address; needsAttestation: true; method: Hex }
    | { needsAttestation: false }
  )) {
    const data = encodeFunctionData({
      abi: companionAbi,
      functionName: 'multicall',
      args: [calls],
    });

    const tx = { to: EARN_VAULT_COMPANION.address(chainId), data, value };

    if (rest.needsAttestation) {
      return this.buildAttestedCallIfActivated(tx, rest.caller, chainId, rest.method);
    }

    return tx;
  }

  private async attestTx(
    tx: BuiltTransaction,
    caller: Address,
    chainId: ChainId
  ): Promise<{ attestation: { deadline: bigint; executionHashes: Hex[] }; signature: Hex }> {
    const result = await this.fetchService.fetch(`https://attester-api.forta.network/attest`, {
      method: 'POST',
      body: JSON.stringify({
        from: caller,
        to: tx.to,
        input: tx.data,
        value: toHex(tx.value ?? 0n),
        chainId,
      }),
      headers: { 'Content-Type': 'application/json' },
    });
    if (!result.ok) {
      throw new Error(`Failed to attest tx. Forta returned: ${await result.text()} (code: ${result.status})`);
    }
    return result.json();
  }

  private async buildAttestedCallIfActivated(tx: BuiltTransaction, caller: Address, chainId: ChainId, method: Hex): Promise<BuiltTransaction> {
    const [, , , activationStatus] = await this.providerService.getViemPublicClient({ chainId }).readContract({
      abi: externalFirewallAbi,
      address: EXTERNAL_FIREWALL.address(chainId),
      functionName: 'getCheckpoint',
      args: [method],
    });

    if (!activationStatus) {
      return tx;
    }

    const { attestation, signature } = await this.attestTx(tx, caller, chainId);
    return {
      to: tx.to,
      value: tx.value,
      data: encodeFunctionData({
        abi: vaultAbi, // same abi as companion for attestedCall
        functionName: 'attestedCall',
        args: [attestation, signature, tx.data as Hex],
      }),
    };
  }

  async getStrategyAsset(params: { chainId: ChainId } & ({ strategyId: StrategyId } | { positionId: PositionId })) {
    const strategyRouter = EARN_STRATEGY_ROUTER.address(params.chainId);
    let assetEncoded;
    if ('strategyId' in params) {
      const [, strategyRegistry, strategyIdString] = params.strategyId.split('-');
      const strategyIdBigInt = BigInt(strategyIdString);
      assetEncoded = await this.providerService.getViemPublicClient({ chainId: params.chainId }).readContract({
        abi: strategyRouterAbi,
        address: strategyRouter,
        functionName: 'routeByStrategyId',
        args: [strategyRegistry as ViemAddress, strategyIdBigInt, ASSET_DATA],
      });
    } else {
      const [, vault, positionIdString] = params.positionId.split('-');
      const positionIdBigInt = BigInt(positionIdString);
      assetEncoded = await this.providerService.getViemPublicClient({ chainId: params.chainId }).readContract({
        abi: strategyRouterAbi,
        address: strategyRouter,
        functionName: 'routeByPositionId',
        args: [vault as ViemAddress, positionIdBigInt, ASSET_DATA],
      });
    }
    return decodeFunctionResult({ abi: strategyAbi, functionName: 'asset', data: assetEncoded });
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
              tokens: rewards.tokens.map((token) => ({
                ...tokens[token.address],
                address: token.address,
                withdrawTypes: token.withdrawTypes,
                apy: token.apy,
              })),
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
    case 'withdrawn specially':
      return {
        ...action,
        withdrawn: action.withdrawn.map(({ token, amount, tokenPrice }) => ({
          token: { ...tokens[token], address: token, price: tokenPrice },
          amount: toAmountsOfToken({
            price: tokenPrice,
            amount,
            decimals: tokens[token].decimals,
          }),
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
  fees: Fee[];
  guardian?: StrategyGuardian;
  tos?: string;
  riskLevel?: StrategyRiskLevel;
  needsTier?: number;
  status: EarnStrategyStatus;
};

type StrategyFarmResponse = {
  id: FarmId;
  chainId: ChainId;
  name: string;
  protocol: string;
  asset: { address: ViemAddress; withdrawTypes: WithdrawType[] };
  rewards?: { tokens: { address: ViemAddress; withdrawTypes: WithdrawType[]; apy?: number }[]; apy: number };
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
  lastUpdatedAt: Timestamp;
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
  | WithdrawnSpeciallyAction
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

type WithdrawnSpeciallyAction = {
  action: 'withdrawn specially';
  withdrawn: {
    token: ViemAddress;
    amount: bigint;
    tokenPrice?: number;
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

const externalFirewallAbi = [
  {
    inputs: [{ internalType: 'bytes4', name: 'selector', type: 'bytes4' }],
    name: 'getCheckpoint',
    outputs: [
      { internalType: 'uint192', name: '', type: 'uint192' },
      { internalType: 'uint16', name: '', type: 'uint16' },
      { internalType: 'uint16', name: '', type: 'uint16' },
      { internalType: 'enum Activation', name: '', type: 'uint8' },
      { internalType: 'bool', name: '', type: 'bool' },
    ],
    stateMutability: 'view',
    type: 'function',
  },
] as const;

function getSelectorFromAbi(abi: any, method: string) {
  const abiFunction = abi.find((item: any) => item.name === method);
  return toFunctionSelector(abiFunction);
}

const ASSET_DATA = encodeFunctionData({
  abi: strategyAbi,
  functionName: 'asset',
});

const SUPPORTED_DEPOSIT_TOKENS_DATA = encodeFunctionData({
  abi: strategyAbi,
  functionName: 'supportedDepositTokens',
});
