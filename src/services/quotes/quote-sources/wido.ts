import { BigNumber } from 'ethers';
import { Chains } from '@chains';
import { QuoteParams, QuoteSourceMetadata, SourceQuoteResponse } from './types';
import { failed } from './utils';
import { AlwaysValidConfigAndContexSource } from './base/always-valid-source';

const SUPPORTED_CHAINS = [
  Chains.ETHEREUM,
  Chains.POLYGON,
  Chains.BNB_CHAIN,
  Chains.AVALANCHE,
  Chains.ARBITRUM,
  Chains.OPTIMISM,
  Chains.FANTOM,
].map(({ chainId }) => chainId);

const WIDO_METADATA: QuoteSourceMetadata<WidoSupport> = {
  name: 'Wido',
  supports: {
    chains: SUPPORTED_CHAINS,
    swapAndTransfer: true,
    buyOrders: false,
  },
  // TODO: Update logo
  logoURI: 'ipfs://QmPQY4siKEJHZGW5F4JDBrUXCBFqfpnKzPA2xDmboeuZzL',
};
type WidoSupport = { buyOrders: false; swapAndTransfer: true };
export class WidoQuoteSource extends AlwaysValidConfigAndContexSource<WidoSupport> {
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
    let url =
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
      url += `&partner=${config.referrer.address}`;
    }

    if (recipient) {
      url += `&recipient=${recipient}`;
    }

    console.log(url);
    const response = await fetchService.fetch(url, {
      timeout,
      headers: {
        accept:
          'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
        'accept-encoding': 'gzip, deflate, br',
        'accept-language': 'es,en;q=0.9,gl;q=0.8,pt;q=0.7',
        'cache-control': 'max-age=0',
        cookie:
          '_ga=GA1.1.697794069.1680872951; __cuid=e1af6c57d95d4f948d802aefe5a90ec5; amp_fef1e8=c464a670-effa-4aa9-b5b3-2e02a0e6d448R...1gte3ebqj.1gte3ebqj.l.7.s; _ga_HV449RKJ94=GS1.1.1680880995.2.1.1680881024.0.0.0',
        dnt: '1',
        'sec-ch-ua': '"Google Chrome";v="111", "Not(A:Brand";v="8", "Chromium";v="111"',
        'sec-ch-ua-mobile': '?0',
        'sec-ch-ua-platform': 'macOS',
        'sec-fetch-dest': 'document',
        'sec-fetch-mode': 'navigate',
        'sec-fetch-site': 'none',
        'sec-fetch-user': '?1',
        'upgrade-insecure-requests': '1',
        'user-agent':
          'Mozilla / 5.0(Macintosh; Intel Mac OS X 10_15_7) AppleWebKit / 537.36(KHTML, like Gecko) Chrome / 111.0.0.0 Safari / 537.36',
      },
      body: undefined,
    });
    if (!response.ok) {
      failed(WIDO_METADATA, chain, sellToken, buyToken, await response.text());
    }
    const { to, value, data, to_token_amount, min_to_token_amount } = await response.json();

    return {
      sellAmount: BigNumber.from(order.sellAmount),
      maxSellAmount: BigNumber.from(order.sellAmount),
      buyAmount: BigNumber.from(to_token_amount),
      minBuyAmount: BigNumber.from(min_to_token_amount),
      type: 'sell',
      estimatedGas: BigNumber.from(0),
      allowanceTarget: to,
      tx: {
        calldata: data,
        to,
        value: BigNumber.from(value ?? 0),
      },
    };
  }
}
