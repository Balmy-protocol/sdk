import { BigNumber, constants } from 'ethers';
import { Chains } from '@chains';
import { NoCustomConfigQuoteSource, QuoteComponents, QuoteSourceMetadata, SourceQuoteRequest, SourceQuoteResponse } from './base';
import { IFetchService } from '@services/fetch/types';
import { addQuoteSlippage, failed, isNativeWrapOrUnwrap } from './utils';

type OneInchSupport = { buyOrders: false; swapAndTransfer: true };
export class OneInchQuoteSource extends NoCustomConfigQuoteSource<OneInchSupport> {
  getMetadata(): QuoteSourceMetadata<OneInchSupport> {
    return {
      name: '1inch',
      supports: {
        chains: [
          Chains.ETHEREUM,
          Chains.BNB_CHAIN,
          Chains.POLYGON,
          Chains.OPTIMISM,
          Chains.ARBITRUM,
          Chains.GNOSIS,
          Chains.AVALANCHE,
          Chains.FANTOM,
          Chains.KLAYTN,
          Chains.AURORA,
        ],
        swapAndTransfer: true,
        buyOrders: false,
      },
      logoURI: 'ipfs://QmNr5MnyZKUv7rMhMyZPbxPbtc1A1yAVAqEEgVbep1hdBx',
    };
  }

  async quote({ fetchService }: QuoteComponents, request: SourceQuoteRequest<OneInchSupport>): Promise<SourceQuoteResponse> {
    const [estimatedGas, { toTokenAmount, to, data, value }] = await Promise.all([
      this.getGasEstimate(fetchService, request),
      this.fetchQuote(fetchService, request),
    ]);

    const quote = {
      sellAmount: request.order.sellAmount,
      buyAmount: BigNumber.from(toTokenAmount),
      estimatedGas,
      allowanceTarget: to,
      tx: {
        to,
        calldata: data,
        value: BigNumber.from(value ?? 0),
      },
    };

    const isWrapOrUnwrap = isNativeWrapOrUnwrap(request.chain, request.sellToken, request.buyToken);
    return addQuoteSlippage(quote, request.order.type, isWrapOrUnwrap ? 0 : request.config.slippagePercentage);
  }

  private async fetchQuote(
    fetchService: IFetchService,
    {
      chain,
      sellToken,
      buyToken,
      order,
      config: { slippagePercentage, timeout },
      accounts: { takeFrom, recipient },
    }: SourceQuoteRequest<OneInchSupport>
  ) {
    let url =
      `https://api.1inch.io/v5.0/${chain.chainId}/swap` +
      `?fromTokenAddress=${sellToken}` +
      `&toTokenAddress=${buyToken}` +
      `&amount=${order.sellAmount.toString()}` +
      `&slippage=${slippagePercentage}` +
      `&disableEstimate=true`;

    if (takeFrom) {
      url += `&fromAddress=${takeFrom}`;
    }

    if (!!recipient && !!takeFrom && takeFrom !== recipient) {
      url += `&destReceiver=${recipient}`;
    }

    if (this.globalConfig.referrerAddress) {
      url += `&referrerAddress=${this.globalConfig.referrerAddress}`;
    }
    const response = await fetchService.fetch(url, { timeout });
    if (!response.ok) {
      failed(chain, sellToken, buyToken);
    }
    const {
      toTokenAmount,
      tx: { to, data, value },
    } = await response.json();
    return { toTokenAmount, to, data, value };
  }

  // We can't use the gas estimate on the /swap endpoint because we need to turn the estimates off
  private async getGasEstimate(
    fetchService: IFetchService,
    { chain, sellToken, buyToken, order, config: { timeout } }: SourceQuoteRequest<OneInchSupport>
  ) {
    const url =
      `https://api.1inch.io/v5.0/${chain.chainId}/quote` +
      `?fromTokenAddress=${sellToken}` +
      `&toTokenAddress=${buyToken}` +
      `&amount=${order.sellAmount.toString()}`;

    const response = await fetchService.fetch(url, { timeout });
    if (!response.ok) {
      return constants.Zero;
    }
    const { estimatedGas } = await response.json();
    return BigNumber.from(estimatedGas);
  }
}
