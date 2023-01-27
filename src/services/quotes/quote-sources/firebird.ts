import { Chains } from '@chains';
import { Addresses } from '@shared/constants';
import { calculateDeadline, isSameAddress } from '@shared/utils';
import { BigNumber, constants } from 'ethers';
import { BaseQuoteSource, QuoteComponents, QuoteSourceMetadata, SourceQuoteRequest, SourceQuoteResponse } from './base';
import { addQuoteSlippage, failed } from './utils';

type FirebirdConfig = { apiKey: string };
type FirebirdSupport = { buyOrders: false; swapAndTransfer: true };
export class FirebirdQuoteSource extends BaseQuoteSource<FirebirdSupport, FirebirdConfig> {
  getMetadata(): QuoteSourceMetadata<FirebirdSupport> {
    return {
      name: 'Firebird',
      supports: {
        chains: [
          Chains.ETHEREUM,
          Chains.FANTOM,
          Chains.CRONOS,
          Chains.POLYGON,
          Chains.BNB_CHAIN,
          Chains.AVALANCHE,
          Chains.ARBITRUM,
          Chains.OPTIMISM,
        ],
        swapAndTransfer: true,
        buyOrders: false,
      },
      // TODO: Update logo
      logoURI: 'ipfs://QmTvX3XyrFDSiDAKPJg9xFgn8DgQbp31wYWE8q7VhaR2c7',
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
      `&source=mean-finance-sdk`;

    if (this.globalConfig.referrerAddress) {
      url += `&ref=${this.globalConfig.referrerAddress}`;
    }
    if (txValidFor) {
      url += `&deadline=${calculateDeadline(txValidFor)}`;
    }

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
      estimatedGas: totalGas,
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
