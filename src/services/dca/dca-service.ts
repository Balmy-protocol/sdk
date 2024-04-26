import qs from 'qs';
import { encodeFunctionData, Hex, Address as ViemAddress } from 'viem';
import { Address, BigIntish, ChainId, TokenAddress, BuiltTransaction, TimeString, Timestamp } from '@types';
import companionAbi from '@shared/abis/companion';
import dcaHubAbi from '@shared/abis/dca-hub';
import { SinglePermitParams, PermitData, IPermit2Service } from '@services/permit2';
import { PERMIT2_ADDRESS } from '@services/permit2/utils/config';
import { isSameAddress, toAmountsOfToken } from '@shared/utils';
import { Addresses } from '@shared/constants';
import { IQuoteService, QuoteRequest } from '@services/quotes';
import {
  CreateDCAPositionParams,
  DCAActionSwapConfig,
  DCAPermissionPermit,
  DCASwapInterval,
  SupportedDCAToken,
  IDCAService,
  IncreaseDCAPositionParams,
  MigrateDCAPositionParams,
  PairInChain,
  ReduceDCAPositionParams,
  ReduceToBuyDCAPositionParams,
  SupportedPair,
  SwapIntervalData,
  TerminateDCAPositionParams,
  TokenVariant,
  TokenVariantPair,
  WithdrawDCAPositionParams,
  PositionId,
  PlatformMessage,
  PositionSummary,
  DCAPermission,
  TransferredAction,
  PermissionsModifiedAction,
  DCAPositionAction,
  TokenVariantId,
  ActionTypeAction,
} from './types';
import { COMPANION_ADDRESS, COMPANION_SWAPPER_ADDRESS, DCA_HUB_ADDRESS, DCA_PERMISSION_MANAGER_ADDRESS } from './config';
import ERC721_ABI from '@shared/abis/erc721';
import { IFetchService } from '@services/fetch';
import { IPriceService, PriceResult } from '@services/prices';
import { IProviderService } from '..';
import { MULTICALL_ADDRESS } from '@services/providers/utils';

export class DCAService implements IDCAService {
  constructor(
    private readonly apiUrl: string,
    private readonly providerService: IProviderService,
    private readonly permit2Service: IPermit2Service,
    private readonly quoteService: IQuoteService,
    private readonly fetchService: IFetchService,
    private readonly priceService: IPriceService
  ) {}

  getAllowanceTarget({
    chainId,
    from,
    depositWith,
    usePermit2,
  }: {
    chainId: ChainId;
    from: TokenAddress;
    depositWith: TokenAddress;
    usePermit2?: boolean;
  }): Address {
    if (usePermit2) {
      return PERMIT2_ADDRESS(chainId);
    } else if (isSameAddress(from, depositWith)) {
      return DCA_HUB_ADDRESS;
    } else {
      return COMPANION_ADDRESS;
    }
  }

  preparePermitData(args: SinglePermitParams): Promise<PermitData> {
    return this.permit2Service.preparePermitData({ ...args, spender: COMPANION_ADDRESS });
  }

  async buildCreatePositionTx({
    chainId,
    from,
    to,
    swapInterval,
    amountOfSwaps,
    owner,
    permissions,
    deposit,
  }: CreateDCAPositionParams): Promise<BuiltTransaction> {
    let depositInfo: { token: Address; amount: bigint; value: bigint };
    if ('token' in deposit) {
      const amount = BigInt(deposit.amount);
      depositInfo = { token: deposit.token, amount, value: isSameAddress(deposit.token, Addresses.NATIVE_TOKEN) ? amount : 0n };
    } else {
      depositInfo = { token: deposit.permitData.token, amount: BigInt(deposit.permitData.amount), value: 0n };
    }

    const needsSwap = !isSameAddress(depositInfo.token, from.variantId);
    if ('token' in deposit && !needsSwap) {
      // If don't need to use Permit2, then just call the hub
      return {
        to: DCA_HUB_ADDRESS,
        data: encodeFunctionData({
          abi: dcaHubAbi,
          functionName: 'deposit',
          args: [
            from.variantId as ViemAddress,
            to.variantId as ViemAddress,
            depositInfo.amount,
            amountOfSwaps,
            swapInterval,
            owner as ViemAddress,
            permissions.map(({ operator, permissions }) => ({
              operator: operator as ViemAddress,
              permissions: permissions.map(mapPermission),
            })),
          ],
        }),
      };
    }

    // If we get to this point, then we'll use the Companion for the deposit
    const calls: Call[] = [];

    // Handle take from caller (if necessary)
    const recipient = needsSwap ? COMPANION_SWAPPER_ADDRESS : COMPANION_ADDRESS;
    if ('permitData' in deposit) {
      calls.push(buildTakeFromCallerWithPermit(deposit.permitData, deposit.signature, recipient));
    } else if (!isSameAddress(depositInfo.token, Addresses.NATIVE_TOKEN)) {
      calls.push(buildTakeFromCaller(depositInfo.token, depositInfo.amount, recipient));
    }

    // Handle swap
    if (needsSwap) {
      const { swapData } = await this.getSwapData({
        request: {
          chainId,
          sellToken: depositInfo.token,
          buyToken: from.variantId,
          order: { type: 'sell', sellAmount: depositInfo.amount },
        },
        leftoverRecipient: owner,
        swapConfig: deposit?.swapConfig,
      });
      calls.push(swapData);
    }

    // Handle deposit
    calls.push(
      encodeFunctionData({
        abi: companionAbi,
        functionName: 'depositWithBalanceOnContract',
        args: [
          DCA_HUB_ADDRESS,
          from.variantId as ViemAddress,
          to.variantId as ViemAddress,
          amountOfSwaps,
          swapInterval,
          owner as ViemAddress,
          permissions.map(({ operator, permissions }) => ({
            operator: operator as ViemAddress,
            permissions: permissions.map(mapPermission),
          })),
          '0x',
        ],
      })
    );

    // Build multicall and return tx
    return buildCompanionMulticall({ calls, value: depositInfo.value });
  }

  async buildIncreasePositionTx({
    chainId,
    positionId,
    increase,
    amountOfSwaps,
    permissionPermit,
    dcaHub,
  }: IncreaseDCAPositionParams): Promise<BuiltTransaction> {
    const hubAddress = dcaHub ?? DCA_HUB_ADDRESS;
    let increaseInfo: { token: Address; amount: bigint; value: bigint };
    if (!increase) {
      increaseInfo = { token: Addresses.ZERO_ADDRESS, amount: 0n, value: 0n };
    } else if ('token' in increase) {
      const amount = BigInt(increase.amount);
      increaseInfo = { token: increase.token, amount, value: isSameAddress(increase.token, Addresses.NATIVE_TOKEN) ? amount : 0n };
    } else {
      increaseInfo = { token: increase.permitData.token, amount: BigInt(increase.permitData.amount), value: 0n };
    }

    const bigIntPositionId = BigInt(positionId);
    const [positionOwner, position] = await this.providerService.getViemPublicClient({ chainId }).multicall({
      contracts: [
        { abi: ERC721_ABI, address: DCA_PERMISSION_MANAGER_ADDRESS, functionName: 'ownerOf', args: [bigIntPositionId] },
        { abi: dcaHubAbi, address: hubAddress as ViemAddress, functionName: 'userPosition', args: [bigIntPositionId] },
      ],
      allowFailure: false,
      multicallAddress: MULTICALL_ADDRESS,
      batchSize: 0,
    });

    const needsSwap = !isSameAddress(increaseInfo.token, position.from);
    const callHubDirectly = !increase || increaseInfo.amount === 0n || amountOfSwaps === 0 || ('token' in increase && !needsSwap);

    if (callHubDirectly) {
      // If don't need to use Permit2, then just call the hub
      return {
        to: hubAddress,
        data: encodeFunctionData({
          abi: dcaHubAbi,
          functionName: 'increasePosition',
          args: [BigInt(positionId), BigInt(increaseInfo.amount), amountOfSwaps],
        }),
      };
    }

    // If we get to this point, then we'll use the Companion for the increase
    const calls: Call[] = [];

    const recipient = needsSwap ? COMPANION_SWAPPER_ADDRESS : COMPANION_ADDRESS;
    if ('permitData' in increase!) {
      // Handle take from caller (if necessary)
      calls.push(buildTakeFromCallerWithPermit(increase.permitData, increase.signature, recipient));
    } else if (!isSameAddress(increaseInfo.token, Addresses.NATIVE_TOKEN)) {
      calls.push(buildTakeFromCaller(increaseInfo.token, increaseInfo.amount, recipient));
    }

    if (needsSwap) {
      const { swapData } = await this.getSwapData({
        request: {
          chainId,
          sellToken: increaseInfo.token,
          buyToken: position.from,
          order: { type: 'sell', sellAmount: increaseInfo.amount },
        },
        leftoverRecipient: positionOwner,
        swapConfig: increase?.swapConfig,
      });
      calls.push(swapData);
    }

    // Handle permission permit
    if (permissionPermit) {
      calls.push(buildPermissionPermit(permissionPermit, hubAddress));
    }

    // Handle increase
    calls.push(
      encodeFunctionData({
        abi: companionAbi,
        functionName: 'increasePositionWithBalanceOnContract',
        args: [hubAddress as ViemAddress, bigIntPositionId, amountOfSwaps],
      })
    );

    // Build multicall and return tx
    return buildCompanionMulticall({ calls, value: increaseInfo?.value });
  }

  async buildReducePositionTx({
    chainId,
    positionId,
    amountOfSwaps,
    reduce,
    recipient,
    permissionPermit,
    dcaHub,
  }: ReduceDCAPositionParams): Promise<BuiltTransaction> {
    const hubAddress = dcaHub ?? DCA_HUB_ADDRESS;
    const position = await this.getUserPosition(chainId, hubAddress, positionId);
    const shouldConvert = reduce.convertTo && !isSameAddress(position.from, reduce.convertTo);

    if (!shouldConvert) {
      // If don't need to convert anything, then just call the hub
      return {
        to: hubAddress,
        data: encodeFunctionData({
          abi: dcaHubAbi,
          functionName: 'reducePosition',
          args: [BigInt(positionId), BigInt(reduce.amount), amountOfSwaps, recipient as ViemAddress],
        }),
      };
    }

    // If we get to this point, then we'll use the Companion for swap & transfer
    const calls: Call[] = [];

    // Handle permission permit
    if (permissionPermit) {
      calls.push(buildPermissionPermit(permissionPermit, hubAddress));
    }

    // Handle reduce
    calls.push(
      encodeFunctionData({
        abi: companionAbi,
        functionName: 'reducePosition',
        args: [hubAddress as ViemAddress, BigInt(positionId), BigInt(reduce.amount), amountOfSwaps, COMPANION_SWAPPER_ADDRESS],
      })
    );

    // Handle swap
    const outToken = reduce.convertTo!;
    const { swapData } = await this.getSwapData({
      request: {
        chainId,
        sellToken: position.from,
        buyToken: outToken,
        order: { type: 'sell', sellAmount: reduce.amount },
      },
      leftoverRecipient: recipient,
      swapConfig: reduce?.swapConfig,
    });
    calls.push(swapData);

    // Handle transfer
    calls.push(buildSendAllBalance(outToken, recipient));

    // Build multicall and return tx
    return buildCompanionMulticall({ calls });
  }

  async buildReduceToBuyPositionTx({
    chainId,
    positionId,
    amountOfSwaps,
    reduce,
    recipient,
    permissionPermit,
    dcaHub,
  }: ReduceToBuyDCAPositionParams): Promise<BuiltTransaction> {
    const hubAddress = dcaHub ?? DCA_HUB_ADDRESS;
    const calls: Call[] = [];

    const position = await this.getUserPosition(chainId, hubAddress, positionId);
    const shouldConvert = reduce.convertTo && !isSameAddress(position.from, reduce.convertTo);
    if (amountOfSwaps === 0 || !shouldConvert) {
      // In these two scenarios, we can use the normal reduce
      const amount =
        amountOfSwaps === 0
          ? position.remaining // Withdraw everything
          : reduce.amountToBuy; // Withdraw the specified amount
      return this.buildReducePositionTx({
        chainId,
        positionId,
        amountOfSwaps,
        reduce: { amount, convertTo: reduce.convertTo, swapConfig: reduce.swapConfig },
        recipient,
        permissionPermit,
        dcaHub,
      });
    }

    // Handle permission permit
    if (permissionPermit) {
      calls.push(buildPermissionPermit(permissionPermit, hubAddress));
    }

    // Calculate swap (we know we need to swap if we got to this point)
    const outToken = reduce.convertTo!;
    const { bestQuote: buyQuote, swapData } = await this.getSwapData({
      request: {
        chainId,
        sellToken: position.from,
        buyToken: outToken,
        order: { type: 'buy', buyAmount: reduce.amountToBuy },
      },
      leftoverRecipient: recipient,
      swapConfig: reduce?.swapConfig,
    });

    // If we are asking for more than available, then fail
    if (BigInt(buyQuote.maxSellAmount.amount) > position.remaining) {
      throw new Error('Trying to withdraw more than available');
    }

    // Handle reduce
    calls.push(
      encodeFunctionData({
        abi: companionAbi,
        functionName: 'reducePosition',
        args: [hubAddress as ViemAddress, BigInt(positionId), BigInt(buyQuote.maxSellAmount.amount), amountOfSwaps, COMPANION_SWAPPER_ADDRESS],
      })
    );

    // Add swap to calls list (needs to go after reduce)
    calls.push(swapData);

    // Handle transfer
    calls.push(buildSendAllBalance(outToken, recipient));

    // Build multicall and return tx
    return buildCompanionMulticall({ calls });
  }

  async buildWithdrawPositionTx({
    chainId,
    positionId,
    withdraw,
    recipient,
    permissionPermit,
    dcaHub,
  }: WithdrawDCAPositionParams): Promise<BuiltTransaction> {
    const hubAddress = dcaHub ?? DCA_HUB_ADDRESS;
    const position = await this.getUserPosition(chainId, hubAddress, positionId);
    const shouldConvert = withdraw.convertTo && !isSameAddress(position.to, withdraw.convertTo);

    if (!shouldConvert) {
      // If don't need to convert anything, then just call the hub
      return {
        to: hubAddress,
        data: encodeFunctionData({
          abi: dcaHubAbi,
          functionName: 'withdrawSwapped',
          args: [BigInt(positionId), recipient as ViemAddress],
        }),
      };
    }

    // If we get to this point, then we'll use the Companion for swap & transfer
    const calls: Call[] = [];

    // Handle permission permit
    if (permissionPermit) {
      calls.push(buildPermissionPermit(permissionPermit, hubAddress));
    }

    // Handle withdraw
    calls.push(
      encodeFunctionData({
        abi: companionAbi,
        functionName: 'withdrawSwapped',
        args: [hubAddress as ViemAddress, BigInt(positionId), COMPANION_SWAPPER_ADDRESS],
      })
    );

    // Handle swap
    const outToken = withdraw.convertTo!;
    const { swapData } = await this.getSwapData({
      request: {
        chainId,
        sellToken: position.to,
        buyToken: outToken,
        order: { type: 'sell', sellAmount: position.swapped },
      },
      leftoverRecipient: recipient,
      swapConfig: withdraw?.swapConfig,
    });
    calls.push(swapData);

    // Handle transfer
    calls.push(buildSendAllBalance(outToken, recipient));

    // Build multicall and return tx
    return buildCompanionMulticall({ calls });
  }

  async buildTerminatePositionTx({
    chainId,
    positionId,
    withdraw,
    recipient,
    permissionPermit,
    dcaHub,
  }: TerminateDCAPositionParams): Promise<BuiltTransaction> {
    const hubAddress = dcaHub ?? DCA_HUB_ADDRESS;
    const position = await this.getUserPosition(chainId, hubAddress, positionId);
    const shouldConvertUnswapped =
      position.remaining > 0 && !!withdraw.unswappedConvertTo && !isSameAddress(position.from, withdraw.unswappedConvertTo);
    const shouldConvertSwapped = position.swapped > 0 && !!withdraw.swappedConvertTo && !isSameAddress(position.to, withdraw.swappedConvertTo);

    if (!shouldConvertUnswapped && !shouldConvertSwapped) {
      // If don't need to convert anything, then just call the hub
      return {
        to: hubAddress,
        data: encodeFunctionData({
          abi: dcaHubAbi,
          functionName: 'terminate',
          args: [BigInt(positionId), recipient as ViemAddress, recipient as ViemAddress],
        }),
      };
    }

    // If we get to this point, then we'll use the Companion for swap & transfer
    const calls: Call[] = [];

    // Handle permission permit
    if (permissionPermit) {
      calls.push(buildPermissionPermit(permissionPermit, hubAddress));
    }

    // Handle terminate
    calls.push(
      encodeFunctionData({
        abi: companionAbi,
        functionName: 'terminate',
        args: [
          hubAddress as ViemAddress,
          BigInt(positionId),
          shouldConvertUnswapped ? COMPANION_SWAPPER_ADDRESS : (recipient as ViemAddress),
          shouldConvertSwapped ? COMPANION_SWAPPER_ADDRESS : (recipient as ViemAddress),
        ],
      })
    );

    // Handle swaps
    let unswappedPromise: Promise<any>, swappedPromise: Promise<any>;
    if (shouldConvertUnswapped) {
      const convertTo = withdraw.unswappedConvertTo!;
      unswappedPromise = this.getSwapData({
        request: {
          chainId,
          sellToken: position.from,
          buyToken: convertTo,
          order: { type: 'sell', sellAmount: position.remaining },
        },
        leftoverRecipient: recipient,
        swapConfig: withdraw.swapConfig,
      }).then(({ swapData }) =>
        calls.push(
          swapData, // Swap
          buildSendAllBalance(convertTo, recipient) // Transfer
        )
      );
    } else {
      unswappedPromise = Promise.resolve();
    }
    if (shouldConvertSwapped) {
      const convertTo = withdraw.swappedConvertTo!;
      swappedPromise = this.getSwapData({
        request: {
          chainId,
          sellToken: position.to,
          buyToken: convertTo,
          order: { type: 'sell', sellAmount: position.swapped },
        },
        leftoverRecipient: recipient,
        swapConfig: withdraw.swapConfig,
      }).then(({ swapData }) =>
        calls.push(
          swapData, // Swap
          buildSendAllBalance(convertTo, recipient) // Transfer
        )
      );
    } else {
      swappedPromise = Promise.resolve();
    }
    await Promise.all([unswappedPromise, swappedPromise]);

    // Build multicall and return tx
    return buildCompanionMulticall({ calls });
  }

  async buildMigratePositionTx({
    chainId,
    sourceHub,
    targetHub,
    positionId,
    migration,
    permissionPermit,
  }: MigrateDCAPositionParams): Promise<BuiltTransaction> {
    const bigIntPositionId = BigInt(positionId);
    const [positionOwner, position] = await this.providerService.getViemPublicClient({ chainId }).multicall({
      contracts: [
        { abi: ERC721_ABI, address: DCA_PERMISSION_MANAGER_ADDRESS, functionName: 'ownerOf', args: [bigIntPositionId] },
        { abi: dcaHubAbi, address: sourceHub as ViemAddress, functionName: 'userPosition', args: [bigIntPositionId] },
      ],
      allowFailure: false,
      multicallAddress: MULTICALL_ADDRESS,
      batchSize: 0,
    });

    const newFrom = migration.newFrom?.variantId ?? position.from;
    const shouldConvertUnswapped = migration.useFundsFrom !== 'swapped' && position.remaining > 0 && !isSameAddress(position.from, newFrom);
    const shouldConvertSwapped = migration.useFundsFrom !== 'unswapped' && position.swapped > 0 && !isSameAddress(position.to, newFrom);
    const calls: Call[] = [];

    // Handle permission permit
    if (permissionPermit) {
      calls.push(buildPermissionPermit(permissionPermit, sourceHub));
    }

    // Handle terminate
    calls.push(
      encodeFunctionData({
        abi: companionAbi,
        functionName: 'terminate',
        args: [
          sourceHub as ViemAddress,
          bigIntPositionId,
          shouldConvertUnswapped
            ? COMPANION_SWAPPER_ADDRESS
            : migration.useFundsFrom !== 'swapped'
            ? COMPANION_ADDRESS
            : (migration.sendUnusedFundsTo as ViemAddress),
          shouldConvertSwapped
            ? COMPANION_SWAPPER_ADDRESS
            : migration.useFundsFrom !== 'unswapped'
            ? COMPANION_ADDRESS
            : (migration.sendUnusedFundsTo as ViemAddress),
        ],
      })
    );

    // Handle swaps
    let unswappedPromise: Promise<any>, swappedPromise: Promise<any>;
    if (shouldConvertUnswapped) {
      unswappedPromise = this.getSwapData({
        request: {
          chainId,
          sellToken: position.from,
          buyToken: newFrom,
          order: { type: 'sell', sellAmount: position.remaining },
        },
        leftoverRecipient: positionOwner,
        swapConfig: migration?.swapConfig,
      }).then(({ swapData }) => calls.push(swapData));
    } else {
      unswappedPromise = Promise.resolve();
    }
    if (shouldConvertSwapped) {
      swappedPromise = this.getSwapData({
        request: {
          chainId,
          sellToken: position.to,
          buyToken: newFrom,
          order: { type: 'sell', sellAmount: position.swapped },
        },
        leftoverRecipient: positionOwner,
        swapConfig: migration?.swapConfig,
      }).then(({ swapData }) => calls.push(swapData));
    } else {
      swappedPromise = Promise.resolve();
    }

    await Promise.all([unswappedPromise, swappedPromise]);

    // Handle re-deposit
    calls.push(
      encodeFunctionData({
        abi: companionAbi,
        functionName: 'depositWithBalanceOnContract',
        args: [
          targetHub as ViemAddress,
          newFrom as ViemAddress,
          (migration.newTo?.variantId ?? position.to) as ViemAddress,
          position.swapsLeft,
          position.swapInterval,
          positionOwner,
          [],
          '0x',
        ],
      })
    );

    // Build multicall and return tx
    return buildCompanionMulticall({ calls });
  }

  async getSupportedPairs(args?: { chains?: ChainId[]; config?: { timeout?: TimeString } }) {
    const params = qs.stringify({ chains: args?.chains }, { arrayFormat: 'comma', skipNulls: true });
    const url = `${this.apiUrl}/v2/dca/pairs/supported?${params}`;
    const response = await this.fetchService.fetch(url, { timeout: args?.config?.timeout });
    const body: SupportedPairsResponse = await response.json();
    const result: Record<ChainId, { pairs: SupportedPair[]; tokens: Record<TokenAddress, SupportedDCAToken> }> = {};
    for (const chainId in body.pairsByNetwork) {
      const { pairs, tokens } = body.pairsByNetwork[chainId];
      result[Number(chainId)] = {
        pairs: pairs.map((pair) => buildPair(Number(chainId), pair, tokens)),
        tokens,
      };
    }
    return result;
  }

  async getPositionsByAccount({
    accounts,
    chains,
    includeHistory,
    config,
  }: {
    accounts: Address[];
    chains?: ChainId[];
    includeHistory?: boolean;
    config?: { timeout?: TimeString };
  }) {
    const params = qs.stringify({ users: accounts, chains, includeHistory }, { arrayFormat: 'comma', skipNulls: true });
    return this.fetchPositions(params, config?.timeout);
  }

  async getPositionsById({
    ids,
    includeHistory,
    config,
  }: {
    ids: { chainId: ChainId; hub: Address; positionId: number }[];
    includeHistory?: boolean;
    config?: { timeout: TimeString };
  }): Promise<Record<ChainId, PositionSummary[]>> {
    const encodedIds = ids.map(({ chainId, hub, positionId }) => `${chainId}-${hub}-${positionId}`);
    const params = qs.stringify({ ids: encodedIds, includeHistory }, { arrayFormat: 'comma', skipNulls: true });
    return this.fetchPositions(params, config?.timeout);
  }

  async getPairSwaps({
    chainId,
    variantTokenA,
    variantTokenB,
    config,
  }: {
    chainId: ChainId;
    variantTokenA: TokenVariantId;
    variantTokenB: TokenVariantId;
    config?: { timeout: TimeString };
  }) {
    const url = `${this.apiUrl}/v2/dca/pairs/${chainId}-${variantTokenA}-${variantTokenB}/swaps`;
    const response = await this.fetchService.fetch(url, { timeout: config?.timeout });
    const { tokenA, tokenB, swaps }: PairSwapsResponse = await response.json();
    return {
      tokenA,
      tokenB,
      swaps: swaps.map((swap) => ({
        ...swap,
        ratioAToB: toBigInt(swap.ratioAToB),
        ratioBToA: toBigInt(swap.ratioBToA),
        ratioAToBWithFee: toBigInt(swap.ratioAToBWithFee),
        ratioBToAWithFee: toBigInt(swap.ratioBToAWithFee),
        intervalsInSwap: swap.intervalsInSwap.map(({ seconds }) => seconds),
      })),
    };
  }

  private async fetchPositions(params: string, timeout: TimeString | undefined) {
    const url = `${this.apiUrl}/v2/dca/positions?${params}`;
    const response = await this.fetchService.fetch(url, { timeout });
    const body: PositionsResponse = await response.json();
    const tokensToFetch = calculateMissingPrices(body);
    const prices =
      tokensToFetch.length === 0
        ? {}
        : await this.priceService.getBulkHistoricalPrices({ addresses: tokensToFetch, config: { timeout: timeout } });

    const result: Record<ChainId, PositionSummary[]> = {};
    for (const chainId in body.positionsByNetwork) {
      const { positions, tokens } = body.positionsByNetwork[chainId];
      result[Number(chainId)] = positions.map((position) => buildPosition(position, tokens, prices[Number(chainId)] ?? {}));
    }
    return result;
  }

  private async getSwapData({
    request,
    leftoverRecipient,
    swapConfig,
  }: {
    request: Pick<QuoteRequest, 'chainId' | 'sellToken' | 'buyToken' | 'order'>;
    leftoverRecipient: Address;
    swapConfig: DCAActionSwapConfig | undefined;
  }) {
    const txValidFor = swapConfig?.txValidFor ?? '1w';
    const bestQuote = await this.quoteService.getBestQuote({
      request: {
        ...request,
        slippagePercentage: swapConfig?.slippagePercentage ?? 0.3,
        takerAddress: COMPANION_SWAPPER_ADDRESS,
        recipient: COMPANION_SWAPPER_ADDRESS,
        txValidFor,
        filters: { includeSources: ['balmy'] }, // TODO: allow more sources and simulate to find the best one
        sourceConfig: { custom: { ['balmy']: { leftoverRecipient } } },
      },
      config: {
        timeout: '5s',
      },
    });

    const allowanceTargets = isSameAddress(bestQuote.source.allowanceTarget, Addresses.ZERO_ADDRESS)
      ? []
      : [{ token: bestQuote.sellToken.address, target: bestQuote.source.allowanceTarget }];

    // Swap adapter uses the cero address as the native token
    const tokenOutDistribution = isSameAddress(bestQuote.buyToken.address, Addresses.NATIVE_TOKEN)
      ? Addresses.ZERO_ADDRESS
      : bestQuote.buyToken.address;

    const arbitraryCall = this.permit2Service.arbitrary.buildArbitraryCallWithoutPermit({
      allowanceTargets,
      calls: [{ to: bestQuote.tx.to, data: bestQuote.tx.data, value: bestQuote.tx.value ?? 0 }],
      distribution: { [tokenOutDistribution]: [{ recipient: COMPANION_ADDRESS, shareBps: 0 }] },
      txValidFor,
      chainId: request.chainId,
    });

    const swapData = encodeFunctionData({
      abi: companionAbi,
      functionName: 'runSwap',
      args: [
        Addresses.ZERO_ADDRESS, // No need to set it because we are already transferring the funds to the swapper
        BigInt(bestQuote.tx.value ?? 0),
        arbitraryCall.data as Hex,
        bestQuote.buyToken.address as ViemAddress,
      ],
    });

    return { bestQuote, swapData };
  }

  private async getUserPosition(
    chainId: ChainId,
    hubAddress: Address,
    positionId: BigIntish
  ): Promise<{ from: TokenAddress; to: TokenAddress; remaining: bigint; swapped: bigint }> {
    const [position] = await this.providerService.getViemPublicClient({ chainId }).multicall({
      contracts: [{ abi: dcaHubAbi, address: hubAddress as ViemAddress, functionName: 'userPosition', args: [BigInt(positionId)] }],
      allowFailure: false,
      multicallAddress: MULTICALL_ADDRESS,
      batchSize: 0,
    });
    return { ...position, remaining: BigInt(position.remaining), swapped: BigInt(position.swapped) };
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

function buildPermissionPermit(permit: DCAPermissionPermit, hub: Address): Hex {
  const permissionManager = PERMISSION_MANAGER_FOR_HUB[hub.toLowerCase() as Lowercase<Address>];
  return encodeFunctionData({
    abi: companionAbi,
    functionName: 'permissionPermit',
    args: [
      permissionManager as ViemAddress,
      permit.permissions.map(({ operator, permissions }) => ({
        operator: operator as ViemAddress,
        permissions: permissions.map(mapPermission),
      })),
      BigInt(permit.tokenId),
      BigInt(permit.deadline),
      parseInt(permit.v.toString()),
      permit.r as Hex,
      permit.s as Hex,
    ],
  });
}

function mapPermission(permission: DCAPermission) {
  switch (permission) {
    case DCAPermission.INCREASE:
      return 0;
    case DCAPermission.REDUCE:
      return 1;
    case DCAPermission.WITHDRAW:
      return 2;
    case DCAPermission.TERMINATE:
      return 3;
  }
}

function buildSendAllBalance(token: TokenAddress, recipient: Address): Hex {
  return encodeFunctionData({
    abi: companionAbi,
    functionName: 'sendBalanceOnContractToRecipient',
    args: [token as ViemAddress, recipient as ViemAddress],
  });
}

async function buildCompanionMulticall({ calls, value }: { calls: Call[]; value?: bigint }) {
  const data = encodeFunctionData({
    abi: companionAbi,
    functionName: 'multicall',
    args: [calls],
  });
  return { to: COMPANION_ADDRESS, data, value };
}

type Call = Hex;

function buildPair(chainId: ChainId, pair: SupportedPairWithIntervals, tokens: Record<TokenAddress, TokenData>): SupportedPair {
  const tokenA = tokens[pair.tokenA];
  const tokenB = tokens[pair.tokenB];
  return {
    chainId: Number(chainId),
    ...pair,
    swapIntervals: buildSwapIntervals(pair.swapIntervals, tokenA, tokenB),
  };
}

function buildSwapIntervals(
  swapIntervals: Record<string, SwapIntervalDataResponse>,
  tokenA: TokenData,
  tokenB: TokenData
): Record<string, SwapIntervalData> {
  const tokenAVariantIds = tokenA.variants.map(({ id }) => id);
  const tokenBVariantIds = tokenB.variants.map(({ id }) => id);
  const variantCombinations = tokenAVariantIds.flatMap((tokenAVariantId) =>
    tokenBVariantIds.map<TokenVariantPair>((tokenBVariantId) => `${tokenAVariantId}-${tokenBVariantId}`)
  );

  const result: Record<string, SwapIntervalData> = {};
  const allIntervals = Object.keys(DCASwapInterval).slice(0, 8);
  for (const seconds of allIntervals) {
    const intervalName = DCASwapInterval[Number(seconds)];
    const nextSwapAvailableAt: Record<TokenVariantPair, Timestamp> = {};
    const isStale: Record<TokenVariantPair, boolean> = {};
    for (const combination of variantCombinations) {
      isStale[combination] = swapIntervals[intervalName]?.stale?.includes(combination) ?? false;
      nextSwapAvailableAt[combination] = swapIntervals[intervalName]?.nextSwapBlockedUntil[combination] ?? 0;
    }
    result[intervalName] = { seconds: Number(seconds), nextSwapAvailableAt, isStale };
  }

  return result;
}

function buildPosition(
  position: PositionSummaryResponse,
  tokens: Record<TokenAddress, TokenData>,
  prices: Record<TokenAddress, Record<Timestamp, PriceResult>>
): PositionSummary {
  const { variants: fromVariants, ...fromToken } = tokens[position.from.address];
  const { variants: toVariants, ...toToken } = tokens[position.to.address];
  const fromVariant = fromVariants.find(({ id }) => id == position.from.variant.id) ?? position.from.variant;
  const toVariant = toVariants.find(({ id }) => id === position.to.variant.id) ?? position.to.variant;
  const [chainId, hub, tokenId] = position.id.split('-');
  return {
    chainId: Number(chainId),
    hub,
    pair: {
      pairId: toPairId(position.from.address, position.to.address),
      variantPairId: toPairId(position.from.variant.id, position.to.variant.id),
    },
    tokenId: BigInt(tokenId),
    ...position,
    from: {
      ...position.from,
      ...fromToken,
      variant: fromVariant,
    },
    to: {
      ...position.to,
      ...toToken,
      variant: toVariant,
    },
    swapInterval: position.swapInterval.seconds,
    rate: toAmountsOfToken({ ...fromToken, amount: position.rate }),
    funds: {
      swapped: toAmountsOfToken({ ...toToken, amount: position.funds.swapped }),
      remaining: toAmountsOfToken({ ...fromToken, amount: position.funds.remaining }),
      toWithdraw: toAmountsOfToken({ ...toToken, amount: position.funds.toWithdraw }),
    },
    generatedByYield: position.yield
      ? {
          swapped: position.yield.swapped === undefined ? undefined : toAmountsOfToken({ ...toToken, amount: position.yield.swapped }),
          remaining: position.yield.remaining === undefined ? undefined : toAmountsOfToken({ ...fromToken, amount: position.yield.remaining }),
          toWithdraw: position.yield.toWithdraw === undefined ? undefined : toAmountsOfToken({ ...toToken, amount: position.yield.toWithdraw }),
        }
      : undefined,
    history: position.history?.map((action) => mapAction(action, position, prices)) ?? [],
  };
}

function toPairId(address1: string, address2: string): `${Address}-${Address}` {
  const lower1 = address1.toLowerCase();
  const lower2 = address2.toLowerCase();
  const [tokenA, tokenB] = lower1 < lower2 ? [lower1, lower2] : [lower2, lower1];
  return `${tokenA}-${tokenB}`;
}

function mapAction(
  action: DCAPositionActionResponse,
  position: PositionSummaryResponse,
  prices: Record<TokenAddress, Record<Timestamp, PriceResult>>
): DCAPositionAction {
  switch (action.action) {
    case ActionTypeAction.CREATED:
      return {
        ...action,
        fromPrice: action.fromPrice ?? prices[position.from.address]?.[action.tx.timestamp]?.price,
        rate: toBigInt(action.rate),
        tx: mapActionTx(action.tx),
      };
    case ActionTypeAction.MODIFIED:
      return {
        ...action,
        fromPrice: action.fromPrice ?? prices[position.from.address]?.[action.tx.timestamp]?.price,
        rate: toBigInt(action.rate),
        oldRate: toBigInt(action.oldRate),
        tx: mapActionTx(action.tx),
      };
    case ActionTypeAction.WITHDRAWN:
      return {
        ...action,
        toPrice: action.toPrice ?? prices[position.to.address]?.[action.tx.timestamp]?.price,
        withdrawn: toBigInt(action.withdrawn),
        generatedByYield: action.yield && { withdrawn: toBigInt(action.yield.withdrawn) },
        tx: mapActionTx(action.tx),
      };
    case ActionTypeAction.TERMINATED:
      return {
        ...action,
        fromPrice: action.fromPrice ?? prices[position.from.address]?.[action.tx.timestamp]?.price,
        toPrice: action.toPrice ?? prices[position.to.address]?.[action.tx.timestamp]?.price,
        withdrawnRemaining: toBigInt(action.withdrawnRemaining),
        withdrawnSwapped: toBigInt(action.withdrawnSwapped),
        generatedByYield: action.yield && {
          withdrawnRemaining: toBigInt(action.yield.withdrawnRemaining),
          withdrawnSwapped: toBigInt(action.yield.withdrawnSwapped),
        },
        tx: mapActionTx(action.tx),
      };
    case ActionTypeAction.SWAPPED:
      return {
        ...action,
        tokenA: {
          address: action.tokenA.address,
          price: action.tokenA.price ?? prices[action.tokenA.address]?.[action.tx.timestamp]?.price,
        },
        tokenB: {
          address: action.tokenB.address,
          price: action.tokenB.price ?? prices[action.tokenB.address]?.[action.tx.timestamp]?.price,
        },
        rate: toBigInt(action.rate),
        swapped: toBigInt(action.swapped),
        ratioAToB: toBigInt(action.ratioAToB),
        ratioBToA: toBigInt(action.ratioBToA),
        ratioAToBWithFee: toBigInt(action.ratioAToBWithFee),
        ratioBToAWithFee: toBigInt(action.ratioBToAWithFee),
        generatedByYield: action.yield && { rate: toBigInt(action.yield.rate) },
        tx: mapActionTx(action.tx),
      };
    case ActionTypeAction.TRANSFERRED:
    case ActionTypeAction.MODIFIED_PERMISSIONS:
      return { ...action, tx: mapActionTx(action.tx) };
  }
}

function mapActionTx(tx: DCAPositionActionResponse['tx']): DCAPositionAction['tx'] {
  return {
    ...tx,
    gasPrice: toBigInt(tx.gasPrice),
    l1GasPrice: toBigInt(tx.l1GasPrice),
    overhead: toBigInt(tx.overhead),
  };
}

function calculateMissingPrices(response: PositionsResponse) {
  const toFetch: { chainId: ChainId; token: TokenAddress; timestamp: Timestamp }[] = [];
  for (const chainIdString in response.positionsByNetwork) {
    const chainId = Number(chainIdString);
    for (const position of response.positionsByNetwork[chainId].positions) {
      for (const action of position.history ?? []) {
        switch (action.action) {
          case ActionTypeAction.CREATED:
          case ActionTypeAction.MODIFIED:
            if (!action.fromPrice) {
              toFetch.push({ chainId, token: position.from.address, timestamp: action.tx.timestamp });
            }
            break;
          case ActionTypeAction.WITHDRAWN:
            if (!action.toPrice) {
              toFetch.push({ chainId, token: position.to.address, timestamp: action.tx.timestamp });
            }
            break;
          case ActionTypeAction.TERMINATED:
            if (!action.fromPrice) {
              toFetch.push({ chainId, token: position.from.address, timestamp: action.tx.timestamp });
            }
            if (!action.toPrice) {
              toFetch.push({ chainId, token: position.to.address, timestamp: action.tx.timestamp });
            }
            break;
          case ActionTypeAction.SWAPPED: {
            if (!action.tokenA.price) {
              toFetch.push({ chainId, token: action.tokenA.address, timestamp: action.tx.timestamp });
            }
            if (!action.tokenB.price) {
              toFetch.push({ chainId, token: action.tokenB.address, timestamp: action.tx.timestamp });
            }
          }
        }
      }
    }
  }
  return toFetch;
}

type SupportedPairsResponse = {
  pairsByNetwork: Record<
    string, // chainId as string
    {
      pairs: SupportedPairWithIntervals[];
      tokens: Record<TokenAddress, TokenData>;
    }
  >;
};
type SupportedPairWithIntervals = {
  id: PairInChain;
  tokenA: TokenAddress;
  tokenB: TokenAddress;
  swapIntervals: Record<TokenVariantPair, SwapIntervalDataResponse>;
};

type SwapIntervalDataResponse = {
  seconds: number;
  nextSwapBlockedUntil: Record<TokenVariantPair, Timestamp>;
  stale: TokenVariantPair[];
};

type TokenData = {
  symbol: string;
  decimals: number;
  name: string;
  variants: TokenVariant[];
  price?: number;
};

type PositionsResponse = {
  positionsByNetwork: Record<string, { positions: PositionSummaryResponse[]; tokens: Record<TokenAddress, TokenData> }>;
};
type PositionSummaryResponse = {
  id: PositionId;
  createdAt: Timestamp;
  from: PositionToken;
  to: PositionToken;
  swapInterval: { seconds: DCASwapInterval };
  owner: Address;
  remainingSwaps: number;
  totalSwaps: number;
  executedSwaps: number;
  isStale: boolean;
  status: 'ongoing' | 'empty' | 'terminated' | 'finished';
  nextSwapAvailableAt: Timestamp;
  permissions: Record<Address, DCAPermission[]>;
  rate: BigIntish;
  funds: PositionFunds;
  yield?: Partial<PositionFunds>;
  platformMessages: PlatformMessage[];
  history?: DCAPositionActionResponse[];
};
type PositionFunds = {
  swapped: BigIntish;
  remaining: BigIntish;
  toWithdraw: BigIntish;
};
type PositionToken = {
  address: TokenAddress;
  variant: TokenVariant;
};
type DCAPositionActionResponse = { tx: DCATransaction } & ActionTypeResponse;
type ActionTypeResponse =
  | CreatedActionResponse
  | ModifiedActionResponse
  | WithdrawnActionResponse
  | TerminatedActionResponse
  | TransferredAction
  | PermissionsModifiedAction
  | SwappedActionResponse;
type CreatedActionResponse = {
  action: ActionTypeAction.CREATED;
  rate: BigIntish;
  swaps: number;
  owner: Address;
  permissions: Record<Address, DCAPermission[]>;
  fromPrice?: number;
};
type ModifiedActionResponse = {
  action: ActionTypeAction.MODIFIED;
  rate: BigIntish;
  remainingSwaps: number;
  oldRate: BigIntish;
  oldRemainingSwaps: number;
  fromPrice?: number;
};
type WithdrawnActionResponse = {
  action: ActionTypeAction.WITHDRAWN;
  withdrawn: BigIntish;
  yield?: { withdrawn: BigIntish };
  toPrice?: number;
};
type TerminatedActionResponse = {
  action: ActionTypeAction.TERMINATED;
  withdrawnRemaining: BigIntish;
  withdrawnSwapped: BigIntish;
  yield?: {
    withdrawnRemaining?: BigIntish;
    withdrawnSwapped?: BigIntish;
  };
  fromPrice?: number;
  toPrice?: number;
};
type SwappedActionResponse = {
  action: ActionTypeAction.SWAPPED;
  rate: BigIntish;
  swapped: BigIntish;
  ratioAToB: BigIntish;
  ratioBToA: BigIntish;
  ratioAToBWithFee: BigIntish;
  ratioBToAWithFee: BigIntish;
  yield?: { rate: BigIntish };
  tokenA: { address: TokenAddress; price?: number };
  tokenB: { address: TokenAddress; price?: number };
};
type DCATransaction = {
  hash: string;
  timestamp: Timestamp;
  gasPrice?: BigIntish;
  l1GasPrice?: BigIntish;
  overhead?: BigIntish;
};

type PairSwapsResponse = {
  tokenA: TokenInPair;
  tokenB: TokenInPair;
  swaps: {
    executedAt: Timestamp;
    ratioAToB: string;
    ratioBToA: string;
    ratioAToBWithFee: string;
    ratioBToAWithFee: string;
    intervalsInSwap: { seconds: DCASwapInterval }[];
  }[];
};
type TokenInPair = {
  address: TokenAddress;
  symbol: string;
  decimals: number;
  name: string;
  price?: number;
  variant: TokenVariant;
};

function toBigInt<T extends BigIntish | undefined>(text: T): T extends BigIntish ? bigint : undefined {
  return (text === undefined ? undefined : BigInt(text)) as T extends BigIntish ? bigint : undefined;
}

const PERMISSION_MANAGER_FOR_HUB: Record<Lowercase<Address>, Address> = {
  // Yield
  '0xa5adc5484f9997fbf7d405b9aa62a7d88883c345': '0x20bdAE1413659f47416f769a4B27044946bc9923',
  // Stable
  '0x059d306a25c4ce8d7437d25743a8b94520536bd5': '0x6f54391fe0386d506b51d69deeb8b04e0544e088',
  // Vuln
  '0x230c63702d1b5034461ab2ca889a30e343d81349': '0xb4edfb45446c6a207643ea846bfa42021ce5ae11',
  // Beta
  '0x24f85583faa9f8bd0b8aa7b1d1f4f53f0f450038': '0x09AdE44D2E60fCa2270fF32Af5a189f40D29837b',
};
