import { Address, BigIntish, BuiltTransaction, ChainId, TokenAddress } from '@types';
import {
  CreateEarnPositionParams,
  EarnActionSwapConfig,
  EarnPermission,
  EarnPermissionPermit,
  IEarnService,
  IncreaseEarnPositionParams,
} from './types';
import { COMPANION_SWAPPER_CONTRACT, EARN_STRATEGY_REGISTRY, EARN_VAULT, EARN_VAULT_COMPANION } from './config';
import { encodeFunctionData, Hex, Address as ViemAddress } from 'viem';
import vaultAbi from '@shared/abis/earn-vault';
import companionAbi from '@shared/abis/earn-vault-companion';
import strategyRegistryAbi from '@shared/abis/earn-strategy-registry';
import strategyAbi from '@shared/abis/earn-strategy';
import { isSameAddress } from '@shared/utils';
import { Addresses, Uint } from '@shared/constants';
import { IPermit2Service, PermitData } from '@services/permit2';
import { IQuoteService, QuoteRequest } from '@services/quotes';
import { IProviderService } from '@services/providers';
import { MULTICALL_CONTRACT } from '@services/providers/utils';
import { IAllowanceService } from '@services/allowances';

export class EarnService implements IEarnService {
  constructor(
    private readonly permit2Service: IPermit2Service,

    private readonly quoteService: IQuoteService,
    private readonly providerService: IProviderService,
    private readonly allowanceService: IAllowanceService
  ) {}

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

    const { needsSwap, asset } = await this.checkIfNeedsSwap({ chainId, strategyId, depositToken: depositInfo.token });

    if ('token' in deposit && !needsSwap) {
      // If don't need to use Permit2, then just call the vault
      return {
        to: vault,
        data: encodeFunctionData({
          abi: vaultAbi,
          functionName: 'createPosition',
          args: [
            strategyId,
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
          strategyId,
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
    if (!increase) {
      increaseInfo = { token: Addresses.ZERO_ADDRESS, amount: 0n, value: 0n };
    } else if ('token' in increase) {
      const amount = BigInt(increase.amount);
      increaseInfo = { token: increase.token, amount, value: isSameAddress(increase.token, Addresses.NATIVE_TOKEN) ? amount : 0n };
    } else {
      increaseInfo = { token: increase.permitData.token, amount: BigInt(increase.permitData.amount), value: 0n };
    }

    const bigIntPositionId = BigInt(positionId);
    const [positionOwner, { needsSwap, asset }] = await Promise.all([
      this.providerService.getViemPublicClient({ chainId }).readContract({
        abi: vaultAbi,
        address: vault,
        functionName: 'ownerOf',
        args: [bigIntPositionId],
      }),
      this.checkIfNeedsSwap({ chainId, strategyId: bigIntPositionId, depositToken: increaseInfo.token }),
    ]);
    const callVaultDirectly = !increase || increaseInfo.amount === 0n || ('token' in increase && !needsSwap);

    if (callVaultDirectly) {
      // If don't need to use Permit2, then just call the vault
      return {
        to: vault,
        data: encodeFunctionData({
          abi: vaultAbi,
          functionName: 'increasePosition',
          args: [BigInt(positionId), increaseInfo.token as ViemAddress, increaseInfo.amount],
        }),
        value: increaseInfo.value,
      };
    }

    // If we get to this point, then we'll use the Companion for the increase
    const calls: Hex[] = [];

    const recipient = needsSwap ? COMPANION_SWAPPER_CONTRACT.address(chainId) : companion;
    if ('permitData' in increase!) {
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
    if (permissionPermit && 'signature' in increase) {
      calls.push(buildPermissionPermit(bigIntPositionId, increase.signature as Hex, permissionPermit, vault));
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
    return buildCompanionMulticall({ chainId, calls, value: increaseInfo?.value });
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
    const bestQuote = await this.quoteService.getBestQuote({
      request: {
        ...request,
        slippagePercentage: swapConfig?.slippagePercentage ?? 0.3,
        takerAddress: COMPANION_SWAPPER_CONTRACT.address(request.chainId),
        recipient: COMPANION_SWAPPER_CONTRACT.address(request.chainId),
        txValidFor,
        filters: { includeSources: ['balmy'] }, // TODO: allow more sources and simulate to find the best one
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

function buildPermissionPermit(positionId: bigint, signature: Hex, permit: EarnPermissionPermit, vault: Address): Hex {
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
      signature,
    ],
  });
}

function mapPermission(permission: EarnPermission) {
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
