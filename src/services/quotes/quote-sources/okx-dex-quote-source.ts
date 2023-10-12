import qs from 'qs';
import { Chains } from '@chains';
import { IQuoteSource, QuoteParams, QuoteSourceMetadata, SourceQuoteResponse } from './types';
import { failed } from './utils';
import CryptoJS from 'crypto-js';

const SUPPORTED_CHAINS = [
  Chains.ETHEREUM,
  Chains.OPTIMISM,
  Chains.POLYGON,
  Chains.BNB_CHAIN,
  Chains.OKC,
  Chains.AVALANCHE,
  Chains.FANTOM,
  Chains.ARBITRUM,
  Chains.LINEA,
  Chains.BASE,
];

const OKX_DEX_METADATA: QuoteSourceMetadata<OKXDexSupport> = {
  name: 'OKX Dex',
  supports: {
    chains: SUPPORTED_CHAINS.map(({ chainId }) => chainId),
    swapAndTransfer: false,
    buyOrders: false,
  },
  logoURI: 'ipfs://QmarS9mPPLegvNaazZ8Kqg1gLvkbsvQE2tkdF6uZCvBrFn',
};
type OKXDexConfig = { apiKey: string; secretKey: string; passphrase: string };
type OKXDexSupport = { buyOrders: false; swapAndTransfer: false };
export class OKXDexQuoteSource implements IQuoteSource<OKXDexSupport, OKXDexConfig> {
  getMetadata() {
    return OKX_DEX_METADATA;
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
  }: QuoteParams<OKXDexSupport, OKXDexConfig>): Promise<SourceQuoteResponse> {
    const queryParams = {
      chainId: chain.chainId,
      amount: order.sellAmount.toString(),
      fromTokenAddress: sellToken,
      toTokenAddress: buyToken,
      slippage: slippagePercentage / 100,
      userWalletAddress: takeFrom,
      referrerAddress: config.referrer?.address,
    };
    const queryString = qs.stringify(queryParams, { skipNulls: true, arrayFormat: 'comma' });
    const path = `/api/v5/dex/aggregator/swap?${queryString}`;
    const timestamp = new Date().toISOString();
    const toHash = timestamp + 'GET' + path;
    const signed = CryptoJS.HmacSHA256(toHash, config.secretKey);
    const base64 = CryptoJS.enc.Base64.stringify(signed);

    const headers: HeadersInit = {
      ['OK-ACCESS-KEY']: config.apiKey,
      ['OK-ACCESS-PASSPHRASE']: config.passphrase,
      ['OK-ACCESS-TIMESTAMP']: timestamp,
      ['OK-ACCESS-SIGN']: base64,
    };

    const url = `https://www.okx.com${path}`;
    const response = await fetchService.fetch(url, { timeout, headers });
    if (!response.ok) {
      failed(OKX_DEX_METADATA, chain, sellToken, buyToken, await response.text());
    }
    const { toTokenAmount, minReceiveAmount, estimateGasFee, router, to, value, data } = await response.json();

    return {
      sellAmount: order.sellAmount,
      maxSellAmount: order.sellAmount,
      buyAmount: BigInt(toTokenAmount),
      minBuyAmount: BigInt(minReceiveAmount),
      estimatedGas: BigInt(estimateGasFee),
      allowanceTarget: router,
      type: 'sell',
      tx: {
        calldata: data,
        to,
        value: BigInt(value ?? 0),
      },
    };
  }

  isConfigAndContextValid(config: Partial<OKXDexConfig> | undefined): config is OKXDexConfig {
    return !!config?.apiKey && !!config?.passphrase && !!config?.secretKey;
  }
}
