import { Chains } from '@chains';
import { ChainId } from '@types';
import { isSameAddress } from '@shared/utils';
import { QuoteParams, QuoteSourceMetadata, SourceQuoteResponse } from './types';
import { addQuoteSlippage, failed } from './utils';
import { AlwaysValidConfigAndContexSource } from './base/always-valid-source';

const ZRX_API: Record<ChainId, string> = {
  [Chains.ETHEREUM.chainId]: 'https://api.0x.org',
  [Chains.OPTIMISM.chainId]: 'https://optimism.api.0x.org',
  [Chains.POLYGON.chainId]: 'https://polygon.api.0x.org',
  [Chains.BNB_CHAIN.chainId]: 'https://bsc.api.0x.org',
  [Chains.FANTOM.chainId]: 'https://fantom.api.0x.org',
  [Chains.CELO.chainId]: 'https://celo.api.0x.org',
  [Chains.AVALANCHE.chainId]: 'https://avalanche.api.0x.org',
  [Chains.ARBITRUM.chainId]: 'https://arbitrum.api.0x.org',
  [Chains.ETHEREUM_GOERLI.chainId]: 'https://goerli.api.0x.org',
  [Chains.POLYGON_MUMBAI.chainId]: 'https://mumbai.api.0x.org',
};

const ZRX_METADATA: QuoteSourceMetadata<ZRXSupport> = {
  name: '0x/Matcha',
  supports: {
    chains: Object.keys(ZRX_API).map(Number),
    swapAndTransfer: false,
    buyOrders: true,
  },
  logoURI: 'ipfs://QmPQY4siKEJHZGW5F4JDBrUXCBFqfpnKzPA2xDmboeuZzL',
};
type ZRXConfig = { apiKey?: string };
type ZRXSupport = { buyOrders: true; swapAndTransfer: false };
export class ZRXQuoteSource extends AlwaysValidConfigAndContexSource<ZRXSupport, ZRXConfig> {
  getMetadata() {
    return ZRX_METADATA;
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
  }: QuoteParams<ZRXSupport, ZRXConfig>): Promise<SourceQuoteResponse> {
    const api = ZRX_API[chain.chainId];
    let url =
      `${api}/swap/v1/quote` +
      `?sellToken=${sellToken}` +
      `&buyToken=${buyToken}` +
      `&takerAddress=${takeFrom}` +
      `&skipValidation=true` +
      `&slippagePercentage=${slippagePercentage / 100}` +
      `&enableSlippageProtection=false`;

    if (config.referrer?.address) {
      url += `&affiliateAddress=${config.referrer?.address}`;
    }

    if (order.type === 'sell') {
      url += `&sellAmount=${order.sellAmount.toString()}`;
    } else {
      url += `&buyAmount=${order.buyAmount.toString()}`;
    }

    const headers: HeadersInit = {};
    if (config?.apiKey) {
      headers['0x-api-key'] = config.apiKey;
    }

    const response = await fetchService.fetch(url, { timeout, headers });
    if (!response.ok) {
      failed(ZRX_METADATA, chain, sellToken, buyToken, await response.text());
    }
    const { data, buyAmount, sellAmount, to, allowanceTarget, estimatedGas, value } = await response.json();

    const quote = {
      sellAmount: BigInt(sellAmount),
      buyAmount: BigInt(buyAmount),
      estimatedGas: BigInt(estimatedGas),
      allowanceTarget,
      tx: {
        calldata: data,
        to,
        value: BigInt(value ?? 0),
      },
    };

    return addQuoteSlippage(quote, order.type, isSameAddress(to, chain.wToken) ? 0 : slippagePercentage);
  }
}
