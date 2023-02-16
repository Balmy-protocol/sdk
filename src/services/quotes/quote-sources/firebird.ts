import { Chains } from '@chains';
import { Addresses } from '@shared/constants';
import { calculateDeadline, isSameAddress } from '@shared/utils';
import { BigNumber, constants } from 'ethers';
import { BaseQuoteSource, QuoteComponents, QuoteSourceMetadata, SourceQuoteRequest, SourceQuoteResponse } from './base';
import { addQuoteSlippage, failed } from './utils';

export const FIREBIRD_METADATA: QuoteSourceMetadata<FirebirdSupport> = {
  name: 'Firebird',
  supports: {
    chains: [
      Chains.ETHEREUM.chainId,
      Chains.FANTOM.chainId,
      Chains.CRONOS.chainId,
      Chains.POLYGON.chainId,
      Chains.BNB_CHAIN.chainId,
      Chains.AVALANCHE.chainId,
      Chains.ARBITRUM.chainId,
      Chains.CANTO.chainId,
      Chains.OPTIMISM.chainId,
    ],
    swapAndTransfer: true,
    buyOrders: false,
  },
  logoURI: 'ipfs://QmXJ92XHRWGzRFyUYYt5THiBVTiLwB1KAV35H5UyA3a8Yf',
};
type FirebirdConfig = { apiKey: string };
type FirebirdSupport = { buyOrders: false; swapAndTransfer: true };
export class FirebirdQuoteSource extends BaseQuoteSource<FirebirdSupport, FirebirdConfig> {
  getMetadata() {
    return FIREBIRD_METADATA;
  }

  async quote(
    { fetchService }: QuoteComponents,
    {
      chain,
      sellToken,
      buyToken,
      order,
      accounts: { takeFrom, recipient },
      config: { slippagePercentage, timeout, txValidFor },
    }: SourceQuoteRequest<FirebirdSupport>
  ): Promise<SourceQuoteResponse> {
    const headers = { 'API-KEY': this.customConfig.apiKey };
    let url =
      `https://router.firebird.finance/aggregator/v2/quote` +
      `?chainId=${chain.chainId}` +
      `&from=${sellToken}` +
      `&to=${buyToken}` +
      `&amount=${order.sellAmount.toString()}` +
      `&slippage=${slippagePercentage / 100}` +
      `&receiver=${recipient ?? takeFrom}` +
      `&saveGas=0` +
      `&gasInclude=1`;

    if (this.globalConfig.referrer) {
      url += `&source=${this.globalConfig.referrer.name}`;
      url += `&ref=${this.globalConfig.referrer.address}`;
    }
    if (txValidFor) {
      url += `&deadline=${calculateDeadline(txValidFor)}`;
    }
    console.log(url);

    const quoteResponse = await fetchService.fetch(url, { timeout, headers });
    if (!quoteResponse.ok) {
      failed(chain, sellToken, buyToken, await quoteResponse.text());
    }
    const encodeResponse = await fetchService.fetch(`https://router.firebird.finance/aggregator/v2/encode`, {
      method: 'POST',
      headers,
      body: JSON.stringify(await quoteResponse.json()),
    });
    if (!quoteResponse.ok) {
      failed(chain, sellToken, buyToken, await encodeResponse.text());
    }

    const {
      encodedData: { router, data },
      maxReturn: { totalGas, totalTo },
    } = await encodeResponse.json();

    const quote = {
      sellAmount: order.sellAmount,
      buyAmount: BigNumber.from(totalTo),
      estimatedGas: BigNumber.from(totalGas),
      allowanceTarget: router,
      tx: {
        to: router,
        calldata: data,
        value: isSameAddress(Addresses.NATIVE_TOKEN, sellToken) ? order.sellAmount : constants.Zero,
      },
    };
    return addQuoteSlippage(quote, 'sell', slippagePercentage);
  }
}
