import qs from 'qs';
import { Chains } from '@chains';
import { QuoteParams, QuoteSourceMetadata, SourceQuoteResponse, SourceQuoteTransaction, BuildTxParams, IQuoteSource } from './types';
import { addQuoteSlippage, calculateAllowanceTarget, checksum, failed } from './utils';

const ENSO_METADATA: QuoteSourceMetadata<EnsoSupport> = {
  name: 'Enso',
  supports: {
    chains: [
      Chains.ETHEREUM.chainId,
      Chains.OPTIMISM.chainId,
      Chains.BNB_CHAIN.chainId,
      Chains.GNOSIS.chainId,
      Chains.POLYGON.chainId,
      Chains.BASE.chainId,
      Chains.ARBITRUM.chainId,
      Chains.AVALANCHE.chainId,
    ],
    swapAndTransfer: false,
    buyOrders: false,
  },
  logoURI: 'ipfs://QmWc9U7emJ7YvoLsxCvvJMxnEfMncJXrkqFpGoCP2LxZRJ',
};
type EnsoSupport = { buyOrders: false; swapAndTransfer: false };
type EnsoConfig = { apiKey: string; routingStrategy?: 'router' | 'delegate' | 'ensowallet' };
type EnsoData = { tx: SourceQuoteTransaction };
export class EnsoQuoteSource implements IQuoteSource<EnsoSupport, EnsoConfig, EnsoData> {
  getMetadata() {
    return ENSO_METADATA;
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
  }: QuoteParams<EnsoSupport, EnsoConfig>): Promise<SourceQuoteResponse<EnsoData>> {
    const takeFromChecksummed = checksum(takeFrom);

    const queryParams = {
      fromAddress: takeFromChecksummed,
      spender: takeFromChecksummed,
      receiver: takeFromChecksummed,
      tokenIn: sellToken,
      amountIn: order.sellAmount.toString(),
      tokenOut: buyToken,
      routingStrategy: config?.routingStrategy ?? 'router',
      priceImpact: false,
      chainId: chain.chainId,
      slippage: Math.floor(slippagePercentage * 100),
      tokenInAmountToApprove: order.sellAmount.toString(),
      tokenInAmountToTransfer: order.sellAmount.toString(),
    };

    const queryString = qs.stringify(queryParams, { skipNulls: true, arrayFormat: 'comma' });
    const url = `https://api.enso.finance/api/v1/shortcuts/route?${queryString}`;
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (config.apiKey) {
      headers['Authorization'] = `Bearer ${config.apiKey}`;
    }

    const response = await fetchService.fetch(url, { timeout, headers });
    if (!response.ok) {
      failed(ENSO_METADATA, chain, sellToken, buyToken, await response.text());
    }
    const {
      amountOut,
      gas,
      tx: { data, to, value },
    } = await response.json();

    const quote = {
      sellAmount: order.sellAmount,
      buyAmount: BigInt(amountOut),
      allowanceTarget: calculateAllowanceTarget(sellToken, to),
      estimatedGas: BigInt(gas),
      customData: {
        tx: {
          calldata: data,
          to,
          value: BigInt(value ?? 0),
        },
      },
    };

    return addQuoteSlippage(quote, order.type, slippagePercentage);
  }

  async buildTx({ request }: BuildTxParams<EnsoConfig, EnsoData>): Promise<SourceQuoteTransaction> {
    return request.customData.tx;
  }

  isConfigAndContextValidForQuoting(config: Partial<EnsoConfig> | undefined): config is EnsoConfig {
    return !!config?.apiKey;
  }

  isConfigAndContextValidForTxBuilding(config: Partial<EnsoConfig> | undefined): config is EnsoConfig {
    return true;
  }
}
