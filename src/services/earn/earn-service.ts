import { Address, BigIntish, BuiltTransaction, ChainId, TokenAddress } from '@types';
import { CreateEarnPositionParams, EarnActionSwapConfig, EarnPermission, IEarnService } from './types';
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
import { PERMIT2_CONTRACT } from '@services/permit2/utils/config';

export class EarnService implements IEarnService {
  constructor(
    private readonly permit2Service: IPermit2Service,
    private readonly quoteService: IQuoteService,
    private readonly providerService: IProviderService,
    private readonly allowanceService: IAllowanceService
  ) {}

  async getAllowanceTarget({
    chainId,
    strategyId,
    depositWith,
    usePermit2,
  }: {
    chainId: ChainId;
    strategyId: BigIntish;
    depositWith: TokenAddress;
    usePermit2?: boolean;
  }): Promise<Address | undefined> {
    if (isSameAddress(depositWith, Addresses.NATIVE_TOKEN)) {
      return undefined;
    } else if (usePermit2) {
      return PERMIT2_CONTRACT.address(chainId);
    }

    const { needsSwap } = await this.checkIfNeedsSwap({ chainId, strategyId, depositToken: depositWith });
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

    const { needsSwap, asset } = await this.checkIfNeedsSwap({ chainId, strategyId, depositToken: depositInfo.token });

    if ('token' in deposit && !needsSwap) {
      // If don't need to use Permit2, then just call the vault
      return {
        to: vault,
        data: encodeFunctionData({
          abi: vaultAbi,
          functionName: 'createPosition',
          args: [
            BigInt(strategyId),
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
          BigInt(strategyId),
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

  private async checkIfNeedsSwap({ chainId, strategyId, depositToken }: { chainId: ChainId; strategyId: BigIntish; depositToken: Address }) {
    // Get the strategy from the strategy registry
    const strategy = await this.providerService.getViemPublicClient({ chainId }).readContract({
      abi: strategyRegistryAbi,
      address: EARN_STRATEGY_REGISTRY.address(chainId),
      functionName: 'getStrategy',
      args: [BigInt(strategyId)],
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
