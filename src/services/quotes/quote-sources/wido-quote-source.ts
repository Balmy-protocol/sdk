import { Chains } from '@chains';
import { QuoteParams, QuoteSourceMetadata, SourceQuoteResponse } from './types';
import { calculateAllowanceTarget, failed } from './utils';
import { AlwaysValidConfigAndContextSource } from './base/always-valid-source';
import { TimeString } from '@types';
import { IFetchService } from '@services/fetch';

const SUPPORTED_CHAINS = [
  Chains.ETHEREUM,
  Chains.POLYGON,
  Chains.BNB_CHAIN,
  Chains.AVALANCHE,
  Chains.ARBITRUM,
  Chains.OPTIMISM,
  Chains.FANTOM,
  Chains.AURORA,
].map(({ chainId }) => chainId);

const WIDO_METADATA: QuoteSourceMetadata<WidoSupport> = {
  name: 'Wido',
  supports: {
    chains: SUPPORTED_CHAINS,
    swapAndTransfer: true,
    buyOrders: false,
  },
  logoURI: 'ipfs://QmVA2eTK8SBnF2iqUdxvTEUgZbcjBq47P1QejQCRSd9im7',
};
type WidoSupport = { buyOrders: false; swapAndTransfer: true };
export class WidoQuoteSource extends AlwaysValidConfigAndContextSource<WidoSupport> {
  getMetadata() {
    return WIDO_METADATA;
  }

  async quote({
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
  }: QuoteParams<WidoSupport>): Promise<SourceQuoteResponse> {
    let quoteUrl =
      `https://api.joinwido.com/quote_v2` +
      `?from_chain_id=${chain.chainId}` +
      `&from_token=${sellToken}` +
      `&to_chain_id=${chain.chainId}` +
      `&to_token=${buyToken}` +
      `&slippage_percentage=${slippagePercentage / 100}` +
      `&amount=${order.sellAmount}` +
      `&user=${takeFrom}` +
      `&validate=false`;

    if (config.referrer?.address) {
      quoteUrl += `&partner=${config.referrer.address}`;
    }
    if (recipient) {
      quoteUrl += `&recipient=${recipient}`;
    }

    const allowanceUrl =
      `https://api.joinwido.com/contract_address` +
      `?chain_id=${chain.chainId}` +
      `&from_token=${sellToken}` +
      `&to_chain_id=${chain.chainId}` +
      `&to_token=${buyToken}`;

    try {
      const [{ to, value, data, to_token_amount, min_to_token_amount }, { spender: allowanceTarget }] = await Promise.all([
        fetch(fetchService, quoteUrl, timeout),
        fetch(fetchService, allowanceUrl, timeout),
      ]);
      return {
        sellAmount: BigInt(order.sellAmount),
        maxSellAmount: BigInt(order.sellAmount),
        buyAmount: BigInt(to_token_amount),
        minBuyAmount: BigInt(min_to_token_amount),
        type: 'sell',
        estimatedGas: undefined,
        allowanceTarget: calculateAllowanceTarget(sellToken, allowanceTarget),
        tx: {
          calldata: data,
          to,
          value: BigInt(value ?? 0),
        },
      };
    } catch (e: any) {
      failed(WIDO_METADATA, chain, sellToken, buyToken, e.message);
    }
  }
}

function fetch(fetchService: IFetchService, url: string, timeout?: TimeString) {
  return fetchService
    .fetch(url, {
      timeout,
      headers: {
        // Recommended by the Wido team. If we don't set this, Cloudfront will block the request for non-browsers
        'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/111.0.0.0 Safari/537.36',
      },
    })
    .then((response) => response.json());
}
