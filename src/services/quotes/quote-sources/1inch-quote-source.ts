import { Chains } from '@chains';
import { Chain } from '@types';
import { QuoteParams, QuoteSourceMetadata, SourceQuoteResponse } from './types';
import { addQuoteSlippage, failed } from './utils';
import { AlwaysValidConfigAndContexSource } from './base/always-valid-source';

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
type OneInchConfig = { customDomain?: string };
export class OneInchQuoteSource extends AlwaysValidConfigAndContexSource<OneInchSupport, OneInchConfig> {
  getMetadata() {
    return ONE_INCH_METADATA;
  }

  async quote(params: QuoteParams<OneInchSupport, OneInchConfig>): Promise<SourceQuoteResponse> {
    const [estimatedGas, { toTokenAmount, to, data, value, protocols }] = await Promise.all([
      this.getGasEstimate(params),
      this.getQuote(params),
    ]);

    const quote = {
      sellAmount: params.request.order.sellAmount,
      buyAmount: BigInt(toTokenAmount),
      estimatedGas,
      allowanceTarget: to,
      tx: {
        to,
        calldata: data,
        value: BigInt(value ?? 0),
      },
    };

    const isWrapOrUnwrap = isNativeWrapOrUnwrap(params.request.chain, protocols);
    return addQuoteSlippage(quote, params.request.order.type, isWrapOrUnwrap ? 0 : params.request.config.slippagePercentage);
  }

  private async getQuote({
    components: { fetchService },
    request: {
      chain,
      sellToken,
      buyToken,
      order,
      config: { slippagePercentage, timeout },
      accounts: { takeFrom, recipient },
    },
    config,
  }: QuoteParams<OneInchSupport, OneInchConfig>) {
    const domain = config?.customDomain ?? 'api.1inch.io';
    let url =
      `https://${domain}/v5.0/${chain.chainId}/swap` +
      `?fromTokenAddress=${sellToken}` +
      `&toTokenAddress=${buyToken}` +
      `&amount=${order.sellAmount.toString()}` +
      `&fromAddress=${takeFrom}` +
      `&slippage=${slippagePercentage}` +
      `&disableEstimate=true`;

    if (!!recipient && takeFrom !== recipient) {
      url += `&destReceiver=${recipient}`;
    }

    if (config.referrer?.address) {
      url += `&referrerAddress=${config.referrer.address}`;
    }
    const response = await fetchService.fetch(url, { timeout });
    if (!response.ok) {
      failed(ONE_INCH_METADATA, chain, sellToken, buyToken, await response.text());
    }
    const {
      toTokenAmount,
      tx: { to, data, value },
      protocols,
    } = await response.json();
    return { toTokenAmount, to, data, value, protocols };
  }

  // We can't use the gas estimate on the /swap endpoint because we need to turn the estimates off
  private async getGasEstimate({
    components: { fetchService },
    request: {
      chain,
      sellToken,
      buyToken,
      order,
      config: { timeout },
    },
    config,
  }: QuoteParams<OneInchSupport, OneInchConfig>) {
    const domain = config?.customDomain ?? 'api.1inch.io';
    const url =
      `https://${domain}/v5.0/${chain.chainId}/quote` +
      `?fromTokenAddress=${sellToken}` +
      `&toTokenAddress=${buyToken}` +
      `&amount=${order.sellAmount.toString()}`;
    try {
      const response = await fetchService.fetch(url, { timeout });
      const { estimatedGas } = await response.json();
      return BigInt(estimatedGas);
    } catch {
      return undefined;
    }
  }
}

function isNativeWrapOrUnwrap(chain: Chain, protocols: any) {
  const wTokenSymbol = `W${chain.nativeCurrency.symbol.toUpperCase()}`;
  return (
    protocols.length === 1 &&
    protocols[0].length === 1 &&
    protocols[0][0].length === 1 &&
    protocols[0][0][0].name === wTokenSymbol &&
    protocols[0][0][0].part === 100
  );
}
