import { Chains } from '@chains';
import { Addresses } from '@shared/constants';
import { isSameAddress } from '@shared/utils';
import { AmountOfToken, TokenAddress } from '@types';
import { AlwaysValidConfigAndContexSource } from './base/always-valid-source';
import { QuoteParams, QuoteSourceMetadata, SourceQuoteResponse } from './types';
import { calculateAllowanceTarget, failed } from './utils';

const LI_FI_METADATA: QuoteSourceMetadata<LiFiSupport> = {
  name: 'Li.Fi',
  supports: {
    chains: [
      Chains.ETHEREUM.chainId,
      Chains.POLYGON.chainId,
      Chains.BNB_CHAIN.chainId,
      Chains.GNOSIS.chainId,
      Chains.FANTOM.chainId,
      Chains.OKC.chainId,
      Chains.AVALANCHE.chainId,
      Chains.ARBITRUM.chainId,
      Chains.OPTIMISM.chainId,
      Chains.MOONRIVER.chainId,
      Chains.MOONBEAM.chainId,
      Chains.CELO.chainId,
      Chains.FUSE.chainId,
      Chains.CRONOS.chainId,
      Chains.VELAS.chainId,
      Chains.AURORA.chainId,
      Chains.EVMOS.chainId,
    ],
    swapAndTransfer: true,
    buyOrders: false,
  },
  logoURI: 'ipfs://QmUgcnaNxsgQdjBjytxvXfeSfsDryh9bF4mNaz1Bp5QwJ4',
};
type LiFiSupport = { buyOrders: false; swapAndTransfer: true };
export class LiFiQuoteSource extends AlwaysValidConfigAndContexSource<LiFiSupport> {
  getMetadata() {
    return LI_FI_METADATA;
  }

  async quote({
    components: { fetchService },
    request: {
      chain,
      sellToken,
      buyToken,
      order,
      accounts: { takeFrom, recipient },
      config: { slippagePercentage, timeout },
    },
    config,
  }: QuoteParams<LiFiSupport>): Promise<SourceQuoteResponse> {
    const mappedSellToken = mapNativeToken(sellToken);
    const mappedBuyToken = mapNativeToken(buyToken);
    let url =
      `https://li.quest/v1/quote` +
      `?fromChain=${chain.chainId}` +
      `&toChain=${chain.chainId}` +
      `&fromToken=${mappedSellToken}` +
      `&toToken=${mappedBuyToken}` +
      `&fromAddress=${takeFrom}` +
      `&toAddress=${recipient ?? takeFrom}` +
      `&fromAmount=${order.sellAmount.toString()}` +
      `&slippage=${slippagePercentage / 100}`;

    if (config.referrer) {
      url += `&integrator=${config.referrer.name}`;
      url += `&referrer=${config.referrer.address}`;
    }
    const response = await fetchService.fetch(url, { timeout });
    if (!response.ok) {
      failed(LI_FI_METADATA, chain, sellToken, buyToken, await response.text());
    }
    const {
      estimate: { approvalAddress, toAmountMin, toAmount, gasCosts },
      transactionRequest: { to, data, value },
    } = await response.json();

    const estimatedGas = (gasCosts as { estimate: AmountOfToken }[]).reduce((accum, { estimate }) => accum + BigInt(estimate), 0n);

    return {
      sellAmount: order.sellAmount,
      maxSellAmount: order.sellAmount,
      buyAmount: BigInt(toAmount),
      minBuyAmount: BigInt(toAmountMin),
      type: 'sell',
      estimatedGas,
      allowanceTarget: calculateAllowanceTarget(sellToken, approvalAddress),
      tx: {
        to,
        calldata: data,
        value: BigInt(value ?? 0),
      },
    };
  }
}

function mapNativeToken(address: TokenAddress) {
  return isSameAddress(address, Addresses.NATIVE_TOKEN) ? '0x0000000000000000000000000000000000000000' : address;
}
