import { Chains, getChainByKey } from '@chains';
import { QuoteParams, QuoteSourceMetadata, SourceQuoteResponse, SourceQuoteTransaction, BuildTxParams } from './types';
import qs from 'qs';
import { addQuoteSlippage, calculateAllowanceTarget, failed } from './utils';
import { AlwaysValidConfigAndContextSource } from './base/always-valid-source';

const SUSHISWAP_METADATA: QuoteSourceMetadata<SushiswapSupport> = {
  name: 'Sushiswap',
  supports: {
    chains: [
      Chains.ETHEREUM.chainId,
      Chains.OPTIMISM.chainId,
      Chains.CRONOS.chainId,
      Chains.ROOTSTOCK.chainId,
      Chains.BNB_CHAIN.chainId,
      Chains.GNOSIS.chainId,
      Chains.FUSE.chainId,
      Chains.POLYGON.chainId,
      Chains.SONIC.chainId,
      Chains.FANTOM.chainId,
      Chains.ZK_SYNC_ERA.chainId,
      Chains.MOONBEAM.chainId,
      Chains.MOONRIVER.chainId,
      Chains.KAVA.chainId,
      Chains.MANTLE.chainId,
      Chains.BASE.chainId,
      Chains.MODE.chainId,
      Chains.ARBITRUM.chainId,
      Chains.CELO.chainId,
      Chains.LINEA.chainId,
      Chains.BLAST.chainId,
      Chains.SCROLL.chainId,
    ],
    swapAndTransfer: true,
    buyOrders: false,
  },
  logoURI: 'ipfs://bafkreifo4eejuhgn2m3m476czrjobnyo3juvajc5ql7vgsclgq5b5lruym',
};
type SushiswapConfig = { apiKey: string };
type SushiswapSupport = { buyOrders: false; swapAndTransfer: true };
type SushiswapData = { tx: SourceQuoteTransaction };
export class SushiswapQuoteSource extends AlwaysValidConfigAndContextSource<SushiswapSupport, SushiswapConfig, SushiswapData> {
  getMetadata() {
    return SUSHISWAP_METADATA;
  }
  async quote({
    components: { fetchService },
    request: {
      chainId,
      sellToken,
      buyToken,
      order,
      accounts: { takeFrom, recipient },
      config: { slippagePercentage, timeout },
    },
    config,
  }: QuoteParams<SushiswapSupport, SushiswapConfig>): Promise<SourceQuoteResponse<SushiswapData>> {
    const queryParams = {
      amount: order.sellAmount,
      tokenIn: sellToken,
      tokenOut: buyToken,
      maxSlippage: slippagePercentage / 100,
      sender: takeFrom,
      recipient,
      simulate: !config.disableValidation,
    };

    const queryString = qs.stringify(queryParams, { skipNulls: true, arrayFormat: 'comma' });
    const quoteResponse = await fetchService.fetch(`https://api.sushi.com/swap/v6/${chainId}?${queryString}`, {
      headers: { 'Content-Type': 'application/json' },
      timeout,
    });

    if (!quoteResponse.ok) {
      failed(SUSHISWAP_METADATA, chainId, sellToken, buyToken, await quoteResponse.text());
    }
    const quoteResult = await quoteResponse.json();
    if (quoteResult.status != 'Success') {
      failed(SUSHISWAP_METADATA, chainId, sellToken, buyToken, quoteResult);
    }
    const { amountIn, tx, assumedAmountOut, gasSpent } = quoteResult;
    const quote = {
      sellAmount: BigInt(amountIn),
      buyAmount: BigInt(assumedAmountOut),
      estimatedGas: gasSpent,
      allowanceTarget: calculateAllowanceTarget(sellToken, tx.to),
      customData: {
        tx: {
          calldata: tx.data,
          to: tx.to,
          value: BigInt(tx.value ?? 0),
        },
      },
    };

    return addQuoteSlippage(quote, order.type, slippagePercentage);
  }

  async buildTx({ request }: BuildTxParams<SushiswapConfig, SushiswapData>): Promise<SourceQuoteTransaction> {
    return request.customData.tx;
  }
}
