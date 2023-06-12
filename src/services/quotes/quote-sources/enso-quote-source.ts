import { Chains } from '@chains';
import { QuoteParams, QuoteSourceMetadata, SourceQuoteResponse } from './types';
import { addQuoteSlippage, failed } from './utils';
import { AlwaysValidConfigAndContexSource } from './base/always-valid-source';

const API = 'https://api.enso.finance';

const ENSO_METADATA: QuoteSourceMetadata<EnsoSupport> = {
  name: 'Enso',
  supports: {
    chains: [Chains.ETHEREUM.chainId],
    swapAndTransfer: false,
    buyOrders: false,
  },
  logoURI: 'ipfs://QmWc9U7emJ7YvoLsxCvvJMxnEfMncJXrkqFpGoCP2LxZRJ',
};
type EnsoSupport = { buyOrders: false; swapAndTransfer: false };
export class EnsoQuoteSource extends AlwaysValidConfigAndContexSource<EnsoSupport> {
  getMetadata() {
    return ENSO_METADATA;
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
    },
  }: QuoteParams<EnsoSupport>): Promise<SourceQuoteResponse> {
    const url =
      `${API}/api/v1/shortcuts/route/${chain.chainId}/transaction` +
      `?tokenIn=${sellToken}` +
      `&tokenOut=${buyToken}` +
      `&amount=${order.sellAmount.toString()}` +
      `&slippage=${Math.floor(slippagePercentage * 100)}` +
      `&fromAddress=${takeFrom}`;

    const response = await fetchService.fetch(url, { timeout });
    if (!response.ok) {
      failed(ENSO_METADATA, chain, sellToken, buyToken, await response.text());
    }
    const {
      amountOut,
      tx: { data, to, value },
    } = await response.json();

    const quote = {
      sellAmount: order.sellAmount,
      buyAmount: BigInt(amountOut),
      allowanceTarget: to,
      tx: {
        calldata: data,
        to,
        value: BigInt(value ?? 0),
      },
    };

    return addQuoteSlippage(quote, order.type, slippagePercentage);
  }
}
