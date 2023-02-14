import { BigNumber, constants } from 'ethers';
import { Chains } from '@chains';
import { Chain } from '@types';
import { NoCustomConfigQuoteSource, QuoteComponents, QuoteSourceMetadata, SourceQuoteRequest, SourceQuoteResponse } from './base';
import { IFetchService } from '@services/fetch/types';
import { addQuoteSlippage, failed } from './utils';

export const ONE_INCH_METADATA: QuoteSourceMetadata<OneInchSupport> = {
  name: '1inch',
  supports: {
    chains: [
      Chains.ETHEREUM.chainId,
      Chains.BNB_CHAIN.chainId,
      Chains.POLYGON.chainId,
      Chains.OPTIMISM.chainId,
      Chains.ARBITRUM.chainId,
      Chains.GNOSIS.chainId,
      Chains.AVALANCHE.chainId,
      Chains.FANTOM.chainId,
      Chains.KLAYTN.chainId,
      Chains.AURORA.chainId,
    ],
    swapAndTransfer: true,
    buyOrders: false,
  },
  logoURI: 'ipfs://QmNr5MnyZKUv7rMhMyZPbxPbtc1A1yAVAqEEgVbep1hdBx',
};
type OneInchSupport = { buyOrders: false; swapAndTransfer: true };
export class OneInchQuoteSource extends NoCustomConfigQuoteSource<OneInchSupport> {
  getMetadata() {
    return ONE_INCH_METADATA;
  }

  async quote({ fetchService }: QuoteComponents, request: SourceQuoteRequest<OneInchSupport>): Promise<SourceQuoteResponse> {
    const [estimatedGas, { toTokenAmount, to, data, value, protocols }] = await Promise.all([
      this.getGasEstimate(fetchService, request),
      this.getQuote(fetchService, request),
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

    const isWrapOrUnwrap = isNativeWrapOrUnwrap(request.chain, protocols);
    return addQuoteSlippage(quote, request.order.type, isWrapOrUnwrap ? 0 : request.config.slippagePercentage);
  }

  private async getQuote(
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
      `&fromAddress=${takeFrom}` +
      `&slippage=${slippagePercentage}` +
      `&disableEstimate=true`;

    if (!!recipient && takeFrom !== recipient) {
      url += `&destReceiver=${recipient}`;
    }

    if (this.globalConfig.referrer?.address) {
      url += `&referrerAddress=${this.globalConfig.referrer.address}`;
    }
    const response = await fetchService.fetch(url, { timeout });
    if (!response.ok) {
      failed(chain, sellToken, buyToken, await response.text());
    }
    const {
      toTokenAmount,
      tx: { to, data, value },
      protocols,
    } = await response.json();
    return { toTokenAmount, to, data, value, protocols };
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

function isNativeWrapOrUnwrap(chain: Chain, protocols: any) {
  const wTokenSymbol = `W${chain.currencySymbol.toUpperCase()}`;
  return (
    protocols.length === 1 &&
    protocols[0].length === 1 &&
    protocols[0][0].length === 1 &&
    protocols[0][0][0].name === wTokenSymbol &&
    protocols[0][0][0].part === 100
  );
}
