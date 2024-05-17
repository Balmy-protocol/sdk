import { encodeFunctionData, toHex, Address as ViemAddress, Hex } from 'viem';
import { Address, Chain, ChainId, TimeString } from '@types';
import { Chains } from '@chains';
import { calculateDeadline, isSameAddress, subtractPercentage } from '@shared/utils';
import { Addresses, Uint } from '@shared/constants';
import { BuildTxParams, QuoteParams, QuoteSourceMetadata, SourceQuoteResponse, SourceQuoteTransaction } from './types';
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
type BrainDexConfig = {};
type BrainDexData = { swapPaths: Hex; txValidFor: TimeString | undefined };
export class BrainDexQuoteSource extends AlwaysValidConfigAndContextSource<BrainDexSupport, BrainDexConfig, BrainDexData> {
  getMetadata() {
    return BRAINDEX_METADATA;
  }

  async quote({
    components: { fetchService },
    request: {
      chain,
      sellToken,
      buyToken,
      order,
      config: { slippagePercentage, timeout, txValidFor },
    },
  }: QuoteParams<BrainDexSupport>): Promise<SourceQuoteResponse<BrainDexData>> {
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
    const minBuyAmount = subtractPercentage(buyAmount, slippagePercentage, 'up');

    return {
      sellAmount: order.sellAmount,
      maxSellAmount: order.sellAmount,
      buyAmount,
      minBuyAmount,
      type: 'sell',
      allowanceTarget: calculateAllowanceTarget(sellToken, router),
      customData: { swapPaths: swap_paths, txValidFor },
    };
  }

  async buildTx({
    request: {
      chain,
      sellToken,
      buyToken,
      sellAmount,
      minBuyAmount,
      accounts: { recipient },
      customData: { swapPaths, txValidFor },
    },
  }: BuildTxParams<BrainDexConfig, BrainDexData>): Promise<SourceQuoteTransaction> {
    const mappedSellToken = mapToken(sellToken, chain);
    const mappedBuyToken = mapToken(buyToken, chain);
    const deadline = BigInt(calculateDeadline(txValidFor) ?? Uint.MAX_256);

    let calldata: string;
    let value: bigint = 0n;
    if (isSameAddress(sellToken, Addresses.NATIVE_TOKEN)) {
      calldata = encodeFunctionData({
        abi: ROUTER_ABI,
        functionName: 'multiSwapEthForTokens',
        args: [mappedBuyToken, recipient as ViemAddress, minBuyAmount, deadline, swapPaths],
      });
      value = sellAmount;
    } else if (isSameAddress(buyToken, Addresses.NATIVE_TOKEN)) {
      calldata = encodeFunctionData({
        abi: ROUTER_ABI,
        functionName: 'multiSwapTokensForEth',
        args: [mappedSellToken, recipient as ViemAddress, sellAmount, minBuyAmount, deadline, swapPaths],
      });
    } else {
      calldata = encodeFunctionData({
        abi: ROUTER_ABI,
        functionName: 'multiSwapTokensForTokens',
        args: [mappedSellToken, mappedBuyToken, recipient as ViemAddress, sellAmount, minBuyAmount, deadline, swapPaths],
      });
    }
    return {
      to: ROUTER_ADDRESS[chain.chainId],
      calldata,
      value,
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
