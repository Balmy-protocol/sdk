import qs from 'qs';
import { Chains } from '@chains';
import { calculateDeadline } from '@shared/utils';
import { AlwaysValidConfigAndContextSource } from './base/always-valid-source';
import { BuildTxParams, QuoteParams, QuoteSourceMetadata, SourceQuoteResponse, SourceQuoteTransaction } from './types';
import { addQuoteSlippage, calculateAllowanceTarget, failed } from './utils';

const PARASWAP_METADATA: QuoteSourceMetadata<ParaswapSupport> = {
  name: 'Paraswap',
  supports: {
    chains: [
      Chains.ETHEREUM.chainId,
      Chains.POLYGON.chainId,
      Chains.BNB_CHAIN.chainId,
      Chains.AVALANCHE.chainId,
      Chains.FANTOM.chainId,
      Chains.ARBITRUM.chainId,
      Chains.OPTIMISM.chainId,
      Chains.POLYGON_ZKEVM.chainId,
      Chains.BASE.chainId,
    ],
    swapAndTransfer: true,
    buyOrders: true,
  },
  logoURI: 'ipfs://QmVtj4RwZ5MMfKpbfv8qXksb5WYBJsQXkaZXLq7ipvMNW5',
};
type ParaswapSupport = { buyOrders: true; swapAndTransfer: true };
type ParaswapConfig = { sourceAllowlist?: string[] };
type ParaswapData = { tx: SourceQuoteTransaction };
export class ParaswapQuoteSource extends AlwaysValidConfigAndContextSource<ParaswapSupport, ParaswapConfig, ParaswapData> {
  getMetadata(): QuoteSourceMetadata<ParaswapSupport> {
    return PARASWAP_METADATA;
  }

  async quote({
    components: { fetchService },
    request: {
      chain,
      sellToken,
      buyToken,
      order,
      accounts: { takeFrom, recipient },
      config: { timeout, slippagePercentage, txValidFor },
      external,
    },
    config,
  }: QuoteParams<ParaswapSupport, ParaswapConfig>): Promise<SourceQuoteResponse<ParaswapData>> {
    const {
      sellToken: { decimals: srcDecimals },
      buyToken: { decimals: destDecimals },
    } = await external.tokenData.request();
    const queryParams = {
      network: chain.chainId,
      srcToken: sellToken,
      destToken: buyToken,
      amount: order.type === 'sell' ? order.sellAmount : order.buyAmount,
      side: order.type.toUpperCase(),
      srcDecimals,
      destDecimals,
      includeDEXS: config.sourceAllowlist,
      slippage: slippagePercentage * 100,
      userAddress: takeFrom,
      receiver: takeFrom !== recipient ? recipient : undefined,
      partner: config.referrer?.name,
      partnerAddress: config.referrer?.address,
      partnerFeeBps: 0,
      deadline: calculateDeadline(txValidFor),
      version: '6.2',
    };
    const queryString = qs.stringify(queryParams, { skipNulls: true, arrayFormat: 'comma' });
    const url = `https://api.paraswap.io/swap?${queryString}`;
    const response = await fetchService.fetch(url, { timeout });
    if (!response.ok) {
      failed(PARASWAP_METADATA, chain, sellToken, buyToken, await response.text());
    }
    const {
      priceRoute,
      txParams: { to, data, value },
    } = await response.json();
    const quote = {
      sellAmount: BigInt(priceRoute.srcAmount),
      buyAmount: BigInt(priceRoute.destAmount),
      estimatedGas: BigInt(priceRoute.gasCost),
      allowanceTarget: calculateAllowanceTarget(sellToken, priceRoute.tokenTransferProxy),
      customData: {
        tx: {
          to,
          calldata: data,
          value: BigInt(value ?? 0),
        },
      },
    };
    return addQuoteSlippage(quote, order.type, slippagePercentage);
  }

  async buildTx({ request }: BuildTxParams<ParaswapConfig, ParaswapData>): Promise<SourceQuoteTransaction> {
    return request.customData.tx;
  }
}
