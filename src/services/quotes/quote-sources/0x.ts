import { BigNumber } from 'ethers';
import { Chains } from 'src/chains';
import { ChainId } from '@types';
import { isSameAddress } from '@shared/utils';
import { NoCustomConfigQuoteSource, QuoteComponents, QuoteSourceMetadata, SourceQuoteRequest, SourceQuoteResponse } from './base';
import { addQuoteSlippage, failed } from './utils';

const ZRX_API: Record<ChainId, string> = {
  [Chains.ETHEREUM.chainId]: 'https://api.0x.org',
  [Chains.OPTIMISM.chainId]: 'https://optimism.api.0x.org',
  [Chains.POLYGON.chainId]: 'https://polygon.api.0x.org',
  [Chains.BNB_CHAIN.chainId]: 'https://bsc.api.0x.org',
  [Chains.FANTOM.chainId]: 'https://fantom.api.0x.org',
  [Chains.CELO.chainId]: 'https://celo.api.0x.org',
  [Chains.AVALANCHE.chainId]: 'https://avalanche.api.0x.org',
  [Chains.ARBITRUM.chainId]: 'https://arbitrum.api.0x.org',
};

type ZRXSupport = { buyOrders: true; swapAndTransfer: false };
export class ZRXQuoteSource extends NoCustomConfigQuoteSource<ZRXSupport> {
  getMetadata(): QuoteSourceMetadata<ZRXSupport> {
    return {
      name: '0x/Matcha',
      supports: {
        chains: Object.keys(ZRX_API).map((chainId) => Chains.byKeyOrFail(chainId)),
        swapAndTransfer: false,
        buyOrders: true,
      },
      logoURI: 'ipfs://QmPQY4siKEJHZGW5F4JDBrUXCBFqfpnKzPA2xDmboeuZzL',
    };
  }

  async quote(
    { fetchService }: QuoteComponents,
    { chain, sellToken, buyToken, order, config: { slippagePercentage, timeout }, accounts: { takeFrom } }: SourceQuoteRequest<ZRXSupport>
  ): Promise<SourceQuoteResponse> {
    const api = ZRX_API[chain.chainId];
    let url =
      `${api}/swap/v1/quote` +
      `?sellToken=${sellToken}` +
      `&buyToken=${buyToken}` +
      `&takerAddress=${takeFrom}` +
      `&skipValidation=true` +
      `&slippagePercentage=${slippagePercentage / 100}` +
      `&enableSlippageProtection=false`;

    if (this.globalConfig.referrerAddress) {
      url += `&affiliateAddress=${this.globalConfig.referrerAddress}`;
    }

    if (order.type === 'sell') {
      url += `&sellAmount=${order.sellAmount}`;
    } else {
      url += `&buyAmount=${order.buyAmount}`;
    }

    const response = await fetchService.fetch(url, { timeout });
    if (!response.ok) {
      failed(chain, sellToken, buyToken);
    }
    const { data, buyAmount, sellAmount, to, allowanceTarget, estimatedGas, value } = await response.json();

    const quote = {
      sellAmount: BigNumber.from(sellAmount),
      buyAmount: BigNumber.from(buyAmount),
      calldata: data,
      estimatedGas: BigNumber.from(estimatedGas),
      swapper: {
        allowanceTarget,
        address: to,
      },
      value: BigNumber.from(value ?? 0),
    };

    return addQuoteSlippage(quote, order.type, isSameAddress(to, chain.wToken) ? 0 : slippagePercentage);
  }
}
