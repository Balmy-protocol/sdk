import qs from 'qs';
import { Chains } from '@chains';
import { IQuoteSource, QuoteParams, QuoteSourceMetadata, SourceQuoteResponse, SourceQuoteTransaction, BuildTxParams } from './types';
import { addQuoteSlippage, calculateAllowanceTarget, failed } from './utils';
import { Addresses } from '@shared/constants';
import { isSameAddress } from '@shared/utils';

export const CHANGELLY_METADATA: QuoteSourceMetadata<ChangellySupport> = {
  name: 'Changelly DEX',
  supports: {
    chains: [Chains.ETHEREUM, Chains.OPTIMISM, Chains.ARBITRUM, Chains.BNB_CHAIN, Chains.POLYGON, Chains.FANTOM, Chains.AVALANCHE].map(
      ({ chainId }) => chainId
    ),
    swapAndTransfer: true,
    buyOrders: false,
  },
  logoURI: 'ipfs://Qmbnnx5bD1wytBna4oY8DaL1cw5c5mTStwUMqLCoLt3yHR',
};
type ChangellyConfig = { apiKey: string };
type ChangellySupport = { buyOrders: false; swapAndTransfer: true };
type ChangellyData = { tx: SourceQuoteTransaction };
export class ChangellyQuoteSource implements IQuoteSource<ChangellySupport, ChangellyConfig, ChangellyData> {
  getMetadata() {
    return CHANGELLY_METADATA;
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
  }: QuoteParams<ChangellySupport, ChangellyConfig>): Promise<SourceQuoteResponse<ChangellyData>> {
    const queryParams = {
      fromTokenAddress: sellToken,
      toTokenAddress: buyToken,
      amount: order.sellAmount.toString(),
      slippage: slippagePercentage * 10,
      recipientAddress: recipient && !isSameAddress(recipient, takeFrom) ? recipient : undefined,
      skipValidation: config.disableValidation,
      // We disable RFQ when validation is turned off, because it fails quite often
      takerAddress: config.disableValidation ? undefined : takeFrom,
    };
    const queryString = qs.stringify(queryParams, { skipNulls: true, arrayFormat: 'comma' });
    const url = `https://dex-api.changelly.com/v1/${chainId}/quote?${queryString}`;

    const headers = { 'X-Api-Key': config.apiKey };
    const response = await fetchService.fetch(url, { timeout, headers });
    if (!response.ok) {
      failed(CHANGELLY_METADATA, chainId, sellToken, buyToken, await response.text());
    }
    const { amount_out_total, estimate_gas_total, calldata, to } = await response.json();

    const quote = {
      sellAmount: order.sellAmount,
      buyAmount: BigInt(amount_out_total),
      estimatedGas: BigInt(estimate_gas_total),
      allowanceTarget: calculateAllowanceTarget(sellToken, to),
      customData: {
        tx: {
          to,
          calldata,
          value: isSameAddress(sellToken, Addresses.NATIVE_TOKEN) ? order.sellAmount : 0n,
        },
      },
    };
    return addQuoteSlippage(quote, order.type, slippagePercentage);
  }

  async buildTx({ request }: BuildTxParams<ChangellyConfig, ChangellyData>): Promise<SourceQuoteTransaction> {
    return request.customData.tx;
  }

  isConfigAndContextValidForQuoting(config: Partial<ChangellyConfig> | undefined): config is ChangellyConfig {
    return !!config?.apiKey;
  }

  isConfigAndContextValidForTxBuilding(config: Partial<ChangellyConfig> | undefined): config is ChangellyConfig {
    return true;
  }
}
