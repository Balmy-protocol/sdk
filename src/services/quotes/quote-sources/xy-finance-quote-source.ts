import qs from 'qs';
import { Chains } from '@chains';
import { QuoteParams, QuoteSourceMetadata, SourceQuoteResponse, SourceQuoteTransaction, BuildTxParams } from './types';
import { calculateAllowanceTarget, failed } from './utils';
import { AlwaysValidConfigAndContextSource } from './base/always-valid-source';

// https://docs.xy.finance/supported-blockchains-bridges-dexs
const SUPPORTED_CHAINS = [
  Chains.ETHEREUM,
  Chains.BNB_CHAIN,
  Chains.POLYGON,
  Chains.CRONOS,
  Chains.AVALANCHE,
  Chains.ARBITRUM,
  Chains.OPTIMISM,
  Chains.ASTAR,
  Chains.POLYGON_ZKEVM,
  Chains.LINEA,
  Chains.BASE,
  Chains.SCROLL,
  Chains.BLAST,
  Chains.MANTLE,
];

const XY_FINANCE_METADATA: QuoteSourceMetadata<XYFinanceSupport> = {
  name: 'XY Finance',
  supports: {
    chains: SUPPORTED_CHAINS.map(({ chainId }) => chainId),
    swapAndTransfer: true,
    buyOrders: false,
  },
  logoURI: 'ipfs://Qmeuf9xMFE66UBeBNb9SneyyqSNAhsiNXiHES1vCvpyrFS',
};
type XYFinanceSupport = { buyOrders: false; swapAndTransfer: true };
type XYFinanceConfig = {};
type XYFinanceData = { tx: SourceQuoteTransaction };
export class XYFinanceQuoteSource extends AlwaysValidConfigAndContextSource<XYFinanceSupport, XYFinanceConfig, XYFinanceData> {
  getMetadata() {
    return XY_FINANCE_METADATA;
  }

  async quote({
    components: { fetchService },
    request: {
      chainId,
      sellToken,
      buyToken,
      order,
      config: { slippagePercentage, timeout },
      accounts: { takeFrom, recipient },
    },
    config,
  }: QuoteParams<XYFinanceSupport>): Promise<SourceQuoteResponse<XYFinanceData>> {
    const queryParams = {
      srcChainId: chainId,
      srcQuoteTokenAddress: sellToken,
      srcQuoteTokenAmount: order.sellAmount.toString(),
      dstChainId: chainId,
      dstQuoteTokenAddress: buyToken,
      slippage: slippagePercentage,
      receiver: recipient ?? takeFrom,
      affiliate: config.referrer?.address,
      srcSwapProvider: 'XY DexAggregator',
    };
    const queryString = qs.stringify(queryParams, { skipNulls: true, arrayFormat: 'comma' });
    const url = `https://aggregator-api.xy.finance/v1/buildTx?${queryString}`;

    const response = await fetchService.fetch(url, { timeout });
    if (!response.ok) {
      failed(XY_FINANCE_METADATA, chainId, sellToken, buyToken, await response.text());
    }
    const { success, ...result } = await response.json();
    if (!success) {
      const { errorCode, errorMsg } = result;
      failed(XY_FINANCE_METADATA, chainId, sellToken, buyToken, `Failed with code ${errorCode} and message '${errorMsg}'`);
    }

    const {
      route: { dstQuoteTokenAmount, minReceiveAmount, contractAddress, estimatedGas },
      tx: { to, data, value },
    } = result;

    return {
      sellAmount: order.sellAmount,
      maxSellAmount: order.sellAmount,
      buyAmount: BigInt(dstQuoteTokenAmount),
      minBuyAmount: BigInt(minReceiveAmount),
      estimatedGas: estimatedGas ?? BigInt(estimatedGas),
      allowanceTarget: calculateAllowanceTarget(sellToken, contractAddress),
      type: 'sell',
      customData: {
        tx: {
          calldata: data,
          to,
          value: BigInt(value ?? 0),
        },
      },
    };
  }

  async buildTx({ request }: BuildTxParams<XYFinanceConfig, XYFinanceData>): Promise<SourceQuoteTransaction> {
    return request.customData.tx;
  }
}
