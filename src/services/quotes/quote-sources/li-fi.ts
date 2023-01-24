import { Chains } from '@chains';
import { Addresses } from '@shared/constants';
import { isSameAddress } from '@shared/utils';
import { TokenAddress } from '@types';
import { BigNumber, BigNumberish, constants } from 'ethers';
import { NoCustomConfigQuoteSource, QuoteComponents, QuoteSourceMetadata, SourceQuoteRequest, SourceQuoteResponse } from './base';
import { failed } from './utils';

type LiFiSupport = { buyOrders: false; swapAndTransfer: true };
export class LiFiQuoteSource extends NoCustomConfigQuoteSource<LiFiSupport> {
  getMetadata(): QuoteSourceMetadata<LiFiSupport> {
    return {
      name: 'Li.Fi',
      supports: {
        chains: [
          Chains.ETHEREUM,
          Chains.POLYGON,
          Chains.BNB_CHAIN,
          Chains.GNOSIS,
          Chains.FANTOM,
          Chains.OKC,
          Chains.AVALANCHE,
          Chains.ARBITRUM,
          Chains.OPTIMISM,
          Chains.MOONRIVER,
          Chains.MOONBEAM,
          Chains.CELO,
          Chains.FUSE,
          Chains.CRONOS,
          Chains.VELAS,
          Chains.AURORA,
        ],
        swapAndTransfer: true,
        buyOrders: false,
      },
      logoURI: 'ipfs://QmUgcnaNxsgQdjBjytxvXfeSfsDryh9bF4mNaz1Bp5QwJ4',
    };
  }

  async quote(
    { fetchService }: QuoteComponents,
    {
      chain,
      sellToken,
      buyToken,
      order,
      accounts: { takeFrom, recipient },
      config: { slippagePercentage, timeout },
    }: SourceQuoteRequest<LiFiSupport>
  ): Promise<SourceQuoteResponse> {
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

    if (this.globalConfig.referrerAddress) {
      url += `&integrator=${this.globalConfig.referrerAddress}`;
    }
    const response = await fetchService.fetch(url, { timeout });
    if (!response.ok) {
      failed(chain, sellToken, buyToken, await response.text());
    }
    const {
      estimate: { approvalAddress, toAmountMin, toAmount, gasCosts },
      transactionRequest: { to, data, value },
    } = await response.json();

    const estimatedGas = (gasCosts as { estimate: BigNumberish }[]).reduce((accum, { estimate }) => accum.add(estimate), constants.Zero);

    return {
      sellAmount: order.sellAmount,
      maxSellAmount: order.sellAmount,
      buyAmount: BigNumber.from(toAmount),
      minBuyAmount: BigNumber.from(toAmountMin),
      type: 'sell',
      estimatedGas,
      allowanceTarget: approvalAddress,
      tx: {
        to,
        calldata: data,
        value: BigNumber.from(value ?? 0),
      },
    };
  }
}

function mapNativeToken(address: TokenAddress) {
  return isSameAddress(address, Addresses.NATIVE_TOKEN) ? '0x0000000000000000000000000000000000000000' : address;
}
