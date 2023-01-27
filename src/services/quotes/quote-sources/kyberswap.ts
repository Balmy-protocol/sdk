import { Chains } from '@chains';
import { Addresses } from '@shared/constants';
import { calculateDeadline, isSameAddress } from '@shared/utils';
import { ChainId } from '@types';
import { BigNumber, constants } from 'ethers';
import { NoCustomConfigQuoteSource, QuoteComponents, QuoteSourceMetadata, SourceQuoteRequest, SourceQuoteResponse } from './base';
import { addQuoteSlippage, failed } from './utils';

const SUPPORTED_CHAINS: Record<ChainId, string> = {
  [Chains.ARBITRUM.chainId]: 'arbitrum',
  [Chains.AURORA.chainId]: 'aurora',
  [Chains.AVALANCHE.chainId]: 'avalanche',
  [Chains.BNB_CHAIN.chainId]: 'bsc',
  [Chains.BIT_TORRENT.chainId]: 'bttc',
  [Chains.CRONOS.chainId]: 'cronos',
  [Chains.ETHEREUM.chainId]: 'ethereum',
  [Chains.FANTOM.chainId]: 'fantom',
  [Chains.OASIS_EMERALD.chainId]: 'oasis',
  [Chains.POLYGON.chainId]: 'polygon',
  [Chains.VELAS.chainId]: 'velas',
  [Chains.OPTIMISM.chainId]: 'optimism',
};

export const KYBERSWAP_METADATA: QuoteSourceMetadata<KyberswapSupport> = {
  name: 'Kyberswap',
  supports: {
    chains: Object.keys(SUPPORTED_CHAINS).map((chainId) => Chains.byKeyOrFail(chainId)),
    swapAndTransfer: true,
    buyOrders: false,
  },
  logoURI: 'ipfs://QmNcTVyqeVtNoyrT546VgJTD4vsZEkWp6zhDJ4qhgKkhbK',
};
type KyberswapSupport = { buyOrders: false; swapAndTransfer: true };
export class KyberswapQuoteSource extends NoCustomConfigQuoteSource<KyberswapSupport> {
  getMetadata() {
    return KYBERSWAP_METADATA;
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
    }: SourceQuoteRequest<KyberswapSupport>
  ): Promise<SourceQuoteResponse> {
    const chainKey = SUPPORTED_CHAINS[chain.chainId];
    let url =
      `https://aggregator-api.kyberswap.com/${chainKey}/route/encode` +
      `?tokenIn=${sellToken}` +
      `&tokenOut=${buyToken}` +
      `&amountIn=${order.sellAmount.toString()}` +
      `&slippageTolerance=${slippagePercentage * 100}` +
      `&to=${recipient ?? takeFrom}`;

    if (txValidFor) {
      url += `&deadline=${calculateDeadline(txValidFor)}`;
    }

    if (this.globalConfig.referrerAddress) {
      url += `&clientData={"source": "${this.globalConfig.referrerAddress}"}`;
    }

    const response = await fetchService.fetch(url, { timeout, headers: { 'Accept-Version': 'Latest' } });
    if (!response.ok) {
      failed(chain, sellToken, buyToken, await response.text());
    }
    const { outputAmount, totalGas, encodedSwapData, routerAddress } = await response.json();

    const value = isSameAddress(sellToken, Addresses.NATIVE_TOKEN) ? order.sellAmount : constants.Zero;
    const quote = {
      sellAmount: order.sellAmount,
      buyAmount: BigNumber.from(outputAmount),
      estimatedGas: BigNumber.from(totalGas),
      allowanceTarget: routerAddress,
      tx: {
        to: routerAddress,
        calldata: encodedSwapData,
        value,
      },
    };

    return addQuoteSlippage(quote, order.type, slippagePercentage);
  }
}
