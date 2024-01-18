import qs from 'qs';
import { Chains } from '@chains';
import { QuoteParams, QuoteSourceMetadata, SourceQuoteResponse } from './types';
import { addQuoteSlippage, calculateAllowanceTarget, checksum, failed } from './utils';
import { AlwaysValidConfigAndContextSource } from './base/always-valid-source';

const ENSO_METADATA: QuoteSourceMetadata<EnsoSupport> = {
  name: 'Enso',
  supports: {
    chains: [
      Chains.ETHEREUM.chainId,
      Chains.OPTIMISM.chainId,
      Chains.BNB_CHAIN.chainId,
      Chains.GNOSIS.chainId,
      Chains.POLYGON.chainId,
      Chains.BASE.chainId,
      Chains.ARBITRUM.chainId,
      Chains.AVALANCHE.chainId,
    ],
    swapAndTransfer: false,
    buyOrders: false,
  },
  logoURI: 'ipfs://QmWc9U7emJ7YvoLsxCvvJMxnEfMncJXrkqFpGoCP2LxZRJ',
};
type EnsoSupport = { buyOrders: false; swapAndTransfer: false };
type EnsoConfig = { apiKey?: string };
export class EnsoQuoteSource extends AlwaysValidConfigAndContextSource<EnsoSupport, EnsoConfig> {
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
    config,
  }: QuoteParams<EnsoSupport, EnsoConfig>): Promise<SourceQuoteResponse> {
    const takeFromChecksummed = checksum(takeFrom);

    const queryParams = {
      fromAddress: takeFromChecksummed,
      spender: takeFromChecksummed,
      receiver: takeFromChecksummed,
      tokenIn: sellToken,
      amountIn: order.sellAmount.toString(),
      tokenOut: buyToken,
      routingStrategy: 'router',
      priceImpact: false,
      chain: chain.chainId,
      slippage: Math.floor(slippagePercentage * 100),
      tokenInAmountToApprove: order.sellAmount.toString(),
      tokenInAmountToTransfer: order.sellAmount.toString(),
    };

    const queryString = qs.stringify(queryParams, { skipNulls: true, arrayFormat: 'comma' });
    const url = `https://api.enso.finance/api/v1/shortcuts/route?${queryString}`;
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (config.apiKey) {
      headers['Authorization'] = `Bearer ${config.apiKey}`;
    }

    const response = await fetchService.fetch(url, { timeout, headers });
    if (!response.ok) {
      failed(ENSO_METADATA, chain, sellToken, buyToken, await response.text());
    }
    const {
      amountOut,
      gas,
      tx: { data, to, value },
    } = await response.json();

    const quote = {
      sellAmount: order.sellAmount,
      buyAmount: BigInt(amountOut),
      allowanceTarget: calculateAllowanceTarget(sellToken, to),
      estimatedGas: BigInt(gas),
      tx: {
        calldata: data,
        to,
        value: BigInt(value ?? 0),
      },
    };

    return addQuoteSlippage(quote, order.type, slippagePercentage);
  }
}
