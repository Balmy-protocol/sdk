import { Address as ViemAddress, encodeFunctionData, formatUnits, parseUnits } from 'viem';
import { Address, ChainId, TokenAddress } from '@types';
import { Chains } from '@chains';
import { Addresses } from '@shared/constants';
import { GasPrice } from '@services/gas';
import { addPercentage, calculateDeadline, isSameAddress, substractPercentage } from '@shared/utils';
import { QuoteParams, QuoteSourceMetadata, SourceQuoteResponse } from './types';
import { calculateAllowanceTarget, failed } from './utils';
import { AlwaysValidConfigAndContextSource } from './base/always-valid-source';

const SWAP_PROXY_ADDRESS = '0xaE382fb775c05130fED953DA2Ee00600470170Dc';
const PERMIT2_ADAPTER_ADDRESS = '0xED306e38BB930ec9646FF3D917B2e513a97530b1';

const CHAINS: Record<ChainId, string> = {
  // [Chains.ARBITRUM.chainId]: 'arbitrum',
  // [Chains.BASE.chainId]: 'base',
  // [Chains.BOBA.chainId]: 'boba',
  // [Chains.BNB_CHAIN.chainId]: 'bsc',
  // [Chains.ETHEREUM.chainId]: 'ethereum',
  // [Chains.MOONBEAM.chainId]: 'moonbeam',
  [Chains.OPTIMISM.chainId]: 'optimism',
  [Chains.POLYGON.chainId]: 'polygon',
  // [Chains.POLYGON_ZKEVM.chainId]: 'polygon-zkevm',
  [Chains.ROOTSTOCK.chainId]: 'rootstock',
  // [Chains.ZKSYNC.chainId]: "zksync",
  // [Chains.SCROLL.chainId]: "scroll",
};

const OKU_METADATA: QuoteSourceMetadata<OkuSupport> = {
  name: 'Oku',
  supports: {
    chains: Object.keys(CHAINS).map(Number),
    swapAndTransfer: false,
    buyOrders: true,
  },
  logoURI: 'ipfs://QmS2Kf7sZz7DrcwWU9nNG8eGt2126G2p2c9PTDFT774sW7',
};
type OkuSupport = { buyOrders: true; swapAndTransfer: false };
// Note: Oku is actually an API that finds routes in Uniswap. The thing is that they have integrated with
// the Universal Router, which required Permit2 to work. Our quote sources can't work directly with Permit2
// so we've built a new contract called SwapProxy, that can be used to provide ERC20 approval features to
// a contract. The way it works, the SwapProxy will take funds from the caller and send them to the
// Permit2Adapter, which will execute the swap. Take into consideration that we are using this contract because
// it allows arbitrary calls, not because we actually use anything related to Permit2.
export class OkuQuoteSource extends AlwaysValidConfigAndContextSource<OkuSupport> {
  getMetadata() {
    return OKU_METADATA;
  }

  async quote({
    components: { fetchService },
    request: {
      chain,
      sellToken,
      buyToken,
      order,
      config: { slippagePercentage, timeout, txValidFor },
      accounts: { takeFrom },
      external,
    },
  }: QuoteParams<OkuSupport>): Promise<SourceQuoteResponse> {
    if (isSameAddress(chain.wToken, sellToken) && isSameAddress(Addresses.NATIVE_TOKEN, buyToken))
      throw new Error(`Native token unwrap not supported by this source`);
    if (isSameAddress(Addresses.NATIVE_TOKEN, sellToken) && isSameAddress(chain.wToken, buyToken))
      throw new Error(`Native token wrap not supported by this source`);

    const [gasPrice, tokenData] = await Promise.all([external.gasPrice.request(), external.tokenData.request()]);
    const body = {
      chain: CHAINS[chain.chainId],
      account: takeFrom,
      gasPrice: Number(eip1159ToLegacy(gasPrice)),
      isExactIn: order.type === 'sell',
      inTokenAddress: mapToken(sellToken),
      outTokenAddress: mapToken(buyToken),
      slippage: slippagePercentage * 100,
      ...(order.type === 'sell'
        ? { inTokenAmount: formatUnits(order.sellAmount, tokenData.sellToken.decimals) }
        : { outTokenAmount: formatUnits(order.buyAmount, tokenData.buyToken.decimals) }),
    };
    const quoteResponse = await fetchService.fetch('https://oku-canoe.fly.dev/market/usor/swap_quote', {
      method: 'POST',
      body: JSON.stringify(body),
      headers: { ['Content-Type']: 'application/json' },
      timeout,
    });
    if (!quoteResponse.ok) {
      failed(OKU_METADATA, chain, sellToken, buyToken, await quoteResponse.text());
    }
    const { coupon, inAmount, outAmount, signingRequest } = await quoteResponse.json();
    const executionResponse = await fetchService.fetch('https://oku-canoe.fly.dev/market/usor/execution_information', {
      method: 'POST',
      body: JSON.stringify({
        coupon,
        signingRequest: signingRequest
          ? {
              ...signingRequest,
              permitSignature: [
                {
                  ...signingRequest.permitSignature[0],
                  signature: '0x0000000000000000000000000000000000000000000000000000000000000001',
                },
              ],
            }
          : undefined,
      }),
      headers: { ['Content-Type']: 'application/json' },
      timeout,
    });
    if (!executionResponse.ok) {
      failed(OKU_METADATA, chain, sellToken, buyToken, await executionResponse.text());
    }
    const {
      trade: { data, to, value },
      approvals,
    } = await executionResponse.json();

    const sellAmount = parseUnits(inAmount, tokenData.sellToken.decimals);
    const buyAmount = parseUnits(outAmount, tokenData.buyToken.decimals);
    const [maxSellAmount, minBuyAmount] =
      order.type === 'sell'
        ? [order.sellAmount, substractPercentage(buyAmount, slippagePercentage, 'up')]
        : [addPercentage(sellAmount, slippagePercentage, 'up'), order.buyAmount];

    const deadline = BigInt(calculateDeadline(txValidFor) ?? calculateDeadline('1w'));
    const tokenOut =
      order.type === 'sell' || isSameAddress(takeFrom, PERMIT2_ADAPTER_ADDRESS)
        ? []
        : [{ token: mapToken(sellToken), distribution: [{ recipient: takeFrom as ViemAddress, shareBps: 0n }] }];
    const adapterData = encodeFunctionData({
      abi: PERMIT2_ADAPTER_ABI,
      functionName: 'executeWithBatchPermit',
      args: [
        { tokens: [], nonce: 0n, signature: '0x' }, // There is nothing to take from the caller, since the swap proxy will already send it to the contract
        approvals?.map((approval: { address: Address; approvee: Address }) => ({
          token: approval.address,
          allowanceTarget: approval.approvee,
        })) ?? [],
        [{ target: to, data, value: BigInt(value ?? 0) }],
        tokenOut,
        deadline,
      ],
    });
    const swapProxyData = encodeFunctionData({
      abi: SWAP_PROXY_ABI,
      functionName: 'swap',
      args: [mapToken(sellToken), maxSellAmount, adapterData],
    });

    return {
      sellAmount,
      maxSellAmount,
      buyAmount,
      minBuyAmount,
      type: order.type,
      allowanceTarget: calculateAllowanceTarget(sellToken, SWAP_PROXY_ADDRESS),
      tx: {
        to: SWAP_PROXY_ADDRESS,
        calldata: swapProxyData,
        value: BigInt(value ?? 0),
      },
    };
  }
}

function mapToken(address: TokenAddress) {
  return isSameAddress(address, Addresses.NATIVE_TOKEN) ? Addresses.ZERO_ADDRESS : (address as ViemAddress);
}

function eip1159ToLegacy(gasPrice: GasPrice): bigint {
  if ('gasPrice' in gasPrice) {
    return BigInt(gasPrice.gasPrice);
  }
  return BigInt(gasPrice.maxFeePerGas);
}

const SWAP_PROXY_ABI = [
  {
    inputs: [
      { internalType: 'address', name: 'token', type: 'address' },
      { internalType: 'uint256', name: 'amount', type: 'uint256' },
      { internalType: 'bytes', name: 'data', type: 'bytes' },
    ],
    name: 'swap',
    outputs: [{ internalType: 'bytes', name: '', type: 'bytes' }],
    stateMutability: 'payable',
    type: 'function',
  },
] as const;

const PERMIT2_ADAPTER_ABI = [
  {
    inputs: [
      {
        components: [
          {
            components: [
              { internalType: 'address', name: 'token', type: 'address' },
              { internalType: 'uint256', name: 'amount', type: 'uint256' },
            ],
            internalType: 'struct IPermit2.TokenPermissions[]',
            name: 'tokens',
            type: 'tuple[]',
          },
          { internalType: 'uint256', name: 'nonce', type: 'uint256' },
          { internalType: 'bytes', name: 'signature', type: 'bytes' },
        ],
        internalType: 'struct IArbitraryExecutionPermit2Adapter.BatchPermit',
        name: '_batchPermit',
        type: 'tuple',
      },
      {
        components: [
          { internalType: 'address', name: 'token', type: 'address' },
          { internalType: 'address', name: 'allowanceTarget', type: 'address' },
        ],
        internalType: 'struct IArbitraryExecutionPermit2Adapter.AllowanceTarget[]',
        name: '_allowanceTargets',
        type: 'tuple[]',
      },
      {
        components: [
          { internalType: 'address', name: 'target', type: 'address' },
          { internalType: 'bytes', name: 'data', type: 'bytes' },
          { internalType: 'uint256', name: 'value', type: 'uint256' },
        ],
        internalType: 'struct IArbitraryExecutionPermit2Adapter.ContractCall[]',
        name: '_contractCalls',
        type: 'tuple[]',
      },
      {
        components: [
          { internalType: 'address', name: 'token', type: 'address' },
          {
            components: [
              { internalType: 'address', name: 'recipient', type: 'address' },
              { internalType: 'uint256', name: 'shareBps', type: 'uint256' },
            ],
            internalType: 'struct Token.DistributionTarget[]',
            name: 'distribution',
            type: 'tuple[]',
          },
        ],
        internalType: 'struct IArbitraryExecutionPermit2Adapter.TransferOut[]',
        name: '_transferOut',
        type: 'tuple[]',
      },
      { internalType: 'uint256', name: '_deadline', type: 'uint256' },
    ],
    name: 'executeWithBatchPermit',
    outputs: [
      { internalType: 'bytes[]', name: '_executionResults', type: 'bytes[]' },
      { internalType: 'uint256[]', name: '_tokenBalances', type: 'uint256[]' },
    ],
    stateMutability: 'payable',
    type: 'function',
  },
] as const;
