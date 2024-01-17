import { formatUnits, parseUnits } from 'viem';
import { ChainId, TokenAddress } from '@types';
import { Chains } from '@chains';
import { Addresses } from '@shared/constants';
import { GasPrice } from '@services/gas';
import { isSameAddress } from '@shared/utils';
import { QuoteParams, QuoteSourceMetadata, SourceQuoteResponse } from './types';
import { addQuoteSlippage, calculateAllowanceTarget, failed } from './utils';
import { AlwaysValidConfigAndContextSource } from './base/always-valid-source';

const CHAINS: Record<ChainId, string> = {
  [Chains.ARBITRUM.chainId]: 'arbitrum',
  [Chains.BASE.chainId]: 'base',
  [Chains.BOBA.chainId]: 'boba',
  [Chains.BNB_CHAIN.chainId]: 'bsc',
  [Chains.ETHEREUM.chainId]: 'ethereum',
  [Chains.MOONBEAM.chainId]: 'moonbeam',
  [Chains.OPTIMISM.chainId]: 'optimism',
  [Chains.POLYGON.chainId]: 'polygon',
  [Chains.POLYGON_ZKEVM.chainId]: 'polygon-zkevm',
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
      config: { slippagePercentage, timeout },
      accounts: { takeFrom },
      external,
    },
  }: QuoteParams<OkuSupport>): Promise<SourceQuoteResponse> {
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
    const { coupon, inAmount, outAmount, ...rest1 } = await quoteResponse.json();
    const executionResponse = await fetchService.fetch('https://oku-canoe.fly.dev/market/usor/execution_information', {
      method: 'POST',
      body: JSON.stringify({ coupon }),
      headers: { ['Content-Type']: 'application/json' },
      timeout,
    });
    if (!executionResponse.ok) {
      failed(OKU_METADATA, chain, sellToken, buyToken, await executionResponse.text());
    }
    const {
      trade: { data, to, value },
      ...rest2
    } = await executionResponse.json();

    const quote = {
      sellAmount: parseUnits(inAmount, tokenData.sellToken.decimals),
      buyAmount: parseUnits(outAmount, tokenData.buyToken.decimals),
      allowanceTarget: calculateAllowanceTarget(sellToken, coupon.universalRouter),
      tx: {
        to: to,
        calldata: data,
        value: BigInt(value ?? 0),
      },
    };
    return addQuoteSlippage(quote, order.type, slippagePercentage);
  }
}

function mapToken(address: TokenAddress) {
  return isSameAddress(address, Addresses.NATIVE_TOKEN) ? Addresses.ZERO_ADDRESS : address;
}

function eip1159ToLegacy(gasPrice: GasPrice): bigint {
  if ('gasPrice' in gasPrice) {
    return BigInt(gasPrice.gasPrice);
  }
  return BigInt(gasPrice.maxFeePerGas);
}
