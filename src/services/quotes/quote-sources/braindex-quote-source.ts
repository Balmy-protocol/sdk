import { encodeFunctionData, toHex, Address as ViemAddress, Hex } from 'viem';
import { Address, Chain, ChainId } from '@types';
import { Chains } from '@chains';
import { calculateDeadline, isSameAddress, subtractPercentage } from '@shared/utils';
import { Addresses, Uint } from '@shared/constants';
import { QuoteParams, QuoteSourceMetadata, SourceQuoteResponse } from './types';
import { calculateAllowanceTarget, checksum, failed } from './utils';
import { AlwaysValidConfigAndContextSource } from './base/always-valid-source';

const ROUTER_ADDRESS: Record<ChainId, Address> = {
  [Chains.MOONBEAM.chainId]: '0x415f895a14d47f951f33adc1d2fc1db0191481be',
  [Chains.MOONRIVER.chainId]: '0xf1a3969e1606dff178e99eaab4e90f2b41495b58',
};

const BRAINDEX_METADATA: QuoteSourceMetadata<BrainDexSupport> = {
  name: 'BrainDex',
  supports: {
    chains: Object.keys(ROUTER_ADDRESS).map(Number),
    swapAndTransfer: true,
    buyOrders: false,
  },
  logoURI: 'ipfs://QmYKCxMEdy7BhAokmnarPf9fE2zuyWnXK5bNUcGWRC9c87',
};
type BrainDexSupport = { buyOrders: false; swapAndTransfer: true };
export class BrainDexQuoteSource extends AlwaysValidConfigAndContextSource<BrainDexSupport> {
  getMetadata() {
    return BRAINDEX_METADATA;
  }

  async quote({
    components: { fetchService, providerService },
    request: {
      chain,
      sellToken,
      buyToken,
      order,
      accounts: { takeFrom, recipient },
      config: { slippagePercentage, timeout, txValidFor },
    },
    config,
  }: QuoteParams<BrainDexSupport>): Promise<SourceQuoteResponse> {
    const mappedSellToken = mapToken(sellToken, chain);
    const mappedBuyToken = mapToken(buyToken, chain);
    if (isSameAddress(mappedSellToken, mappedBuyToken)) throw new Error(`Not supported`);

    const body = {
      chain_id: chain.chainId,
      amount_in: toHex(order.sellAmount),
      token_in: mappedSellToken,
      token_out: mappedBuyToken,
      // These values were copied from BrainDex's UI
      max_hops: 3,
      min_splits: 0,
      max_splits: 2,
      count: 5,
    };
    const response = await fetchService.fetch('https://api.braindex.io/api/split_route/multi', {
      method: 'POST',
      body: JSON.stringify(body),
      headers: { 'Content-Type': 'application/json' },
      timeout,
    });
    if (!response.ok) {
      failed(BRAINDEX_METADATA, chain, sellToken, buyToken, await response.text());
    }
    const { amount_out, swap_paths } = await response.json();

    const router = ROUTER_ADDRESS[chain.chainId];
    const buyAmount = BigInt(amount_out);
    const minBuyAmount = BigInt(subtractPercentage(buyAmount, slippagePercentage, 'up'));
    const deadline = BigInt(calculateDeadline(txValidFor) ?? Uint.MAX_256);

    let calldata: string;
    let value: bigint = 0n;
    if (isSameAddress(sellToken, Addresses.NATIVE_TOKEN)) {
      calldata = encodeFunctionData({
        abi: ROUTER_ABI,
        functionName: 'multiSwapEthForTokens',
        args: [mappedBuyToken, (recipient ?? takeFrom) as ViemAddress, minBuyAmount, deadline, swap_paths],
      });
      value = order.sellAmount;
    } else if (isSameAddress(buyToken, Addresses.NATIVE_TOKEN)) {
      calldata = encodeFunctionData({
        abi: ROUTER_ABI,
        functionName: 'multiSwapTokensForEth',
        args: [mappedSellToken, (recipient ?? takeFrom) as ViemAddress, order.sellAmount, minBuyAmount, deadline, swap_paths],
      });
    } else {
      calldata = encodeFunctionData({
        abi: ROUTER_ABI,
        functionName: 'multiSwapTokensForTokens',
        args: [mappedSellToken, mappedBuyToken, (recipient ?? takeFrom) as ViemAddress, order.sellAmount, minBuyAmount, deadline, swap_paths],
      });
    }

    const estimatedGas = config.disableValidation
      ? undefined
      : await providerService.getViemPublicClient(chain).estimateGas({
          account: takeFrom as ViemAddress,
          to: router as ViemAddress,
          data: calldata as Hex,
          value,
        });

    return {
      sellAmount: order.sellAmount,
      maxSellAmount: order.sellAmount,
      buyAmount,
      minBuyAmount,
      type: 'sell',
      allowanceTarget: calculateAllowanceTarget(sellToken, router),
      estimatedGas,
      tx: {
        to: router,
        calldata,
        value,
      },
    };
  }
}

function mapToken(token: Address, chain: Chain): ViemAddress {
  return isSameAddress(token, Addresses.NATIVE_TOKEN) ? checksum(chain.wToken) : checksum(token);
}

const ROUTER_ABI = [
  {
    inputs: [
      { internalType: 'address', name: 'tokenOut', type: 'address' },
      { internalType: 'address', name: 'to', type: 'address' },
      { internalType: 'uint256', name: 'amountOutMin', type: 'uint256' },
      { internalType: 'uint256', name: 'deadline', type: 'uint256' },
      { internalType: 'bytes', name: 'swapData', type: 'bytes' },
    ],
    name: 'multiSwapEthForTokens',
    outputs: [],
    stateMutability: 'payable',
    type: 'function',
  },
  {
    inputs: [
      { internalType: 'address', name: 'tokenIn', type: 'address' },
      { internalType: 'address', name: 'to', type: 'address' },
      { internalType: 'uint256', name: 'amountIn', type: 'uint256' },
      { internalType: 'uint256', name: 'amountOutMin', type: 'uint256' },
      { internalType: 'uint256', name: 'deadline', type: 'uint256' },
      { internalType: 'bytes', name: 'swapData', type: 'bytes' },
    ],
    name: 'multiSwapTokensForEth',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      { internalType: 'address', name: 'tokenIn', type: 'address' },
      { internalType: 'address', name: 'tokenOut', type: 'address' },
      { internalType: 'address', name: 'to', type: 'address' },
      { internalType: 'uint256', name: 'amountIn', type: 'uint256' },
      { internalType: 'uint256', name: 'amountOutMin', type: 'uint256' },
      { internalType: 'uint256', name: 'deadline', type: 'uint256' },
      { internalType: 'bytes', name: 'swapData', type: 'bytes' },
    ],
    name: 'multiSwapTokensForTokens',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
] as const;
