import { BigNumber, constants } from 'ethers';
import { Chains } from '@chains';
import { BaseQuoteSource, QuoteComponents, QuoteSourceMetadata, SourceQuoteRequest, SourceQuoteResponse } from './base';
import { addQuoteSlippage, failed } from './utils';
import { Addresses } from '@shared/constants';
import { isSameAddress } from '@shared/utils';

export const CHANGELLY_METADATA: QuoteSourceMetadata<ChangellySupport> = {
  name: 'Changelly',
  supports: {
    chains: [Chains.ETHEREUM, Chains.OPTIMISM, Chains.BNB_CHAIN, Chains.POLYGON, Chains.FANTOM, Chains.AVALANCHE].map(({ chainId }) => chainId),
    swapAndTransfer: true,
    buyOrders: false,
  },
  logoURI: 'ipfs://Qmbnnx5bD1wytBna4oY8DaL1cw5c5mTStwUMqLCoLt3yHR',
};
type ChangellyConfig = { apiKey: string };
type ChangellySupport = { buyOrders: false; swapAndTransfer: true };
export class ChangellyQuoteSource extends BaseQuoteSource<ChangellySupport, ChangellyConfig> {
  getMetadata() {
    return CHANGELLY_METADATA;
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
    }: SourceQuoteRequest<ChangellySupport>
  ): Promise<SourceQuoteResponse> {
    let url =
      `https://dex-api.changelly.com/v1/${chain.chainId}/quote` +
      `?fromTokenAddress=${sellToken}` +
      `&toTokenAddress=${buyToken}` +
      `&amount=${order.sellAmount.toString()}` +
      `&slippage=${slippagePercentage * 10}` +
      `&recipientAddress=${recipient ?? takeFrom}`;

    const headers = { 'X-Api-Key': this.customConfig.apiKey };
    const response = await fetchService.fetch(url, { timeout, headers });
    if (!response.ok) {
      failed(chain, sellToken, buyToken, await response.text());
    }
    const { amount_out_total, estimate_gas_total, calldata, to } = await response.json();

    const quote = {
      sellAmount: order.sellAmount,
      buyAmount: BigNumber.from(amount_out_total),
      estimatedGas: BigNumber.from(estimate_gas_total),
      allowanceTarget: to,
      tx: {
        to,
        calldata,
        value: isSameAddress(sellToken, Addresses.NATIVE_TOKEN) ? order.sellAmount : constants.Zero,
      },
    };
    return addQuoteSlippage(quote, order.type, slippagePercentage);
  }
}
