import qs from 'qs';
import { Chains } from '@chains';
import { QuoteParams, QuoteSourceMetadata, SourceQuoteResponse, IQuoteSource, SourceQuoteTransaction, BuildTxParams } from './types';
import { addQuoteSlippage, calculateAllowanceTarget, failed } from './utils';
import { isSameAddress } from '@shared/utils';

// Supported networks: https://docs.1inch.io/docs/aggregation-protocol/introduction/#supported-networkschains
export const ONE_INCH_METADATA: QuoteSourceMetadata<OneInchSupport> = {
  name: '1inch',
  supports: {
    chains: [
      Chains.ETHEREUM.chainId,
      Chains.BNB_CHAIN.chainId,
      Chains.POLYGON.chainId,
      Chains.OPTIMISM.chainId,
      Chains.ARBITRUM.chainId,
      Chains.GNOSIS.chainId,
      Chains.AVALANCHE.chainId,
      Chains.FANTOM.chainId,
      Chains.KLAYTN.chainId,
      Chains.AURORA.chainId,
      Chains.BASE.chainId,
    ],
    swapAndTransfer: true,
    buyOrders: false,
  },
  logoURI: 'ipfs://QmNr5MnyZKUv7rMhMyZPbxPbtc1A1yAVAqEEgVbep1hdBx',
};
type OneInchSupport = { buyOrders: false; swapAndTransfer: true };
type CustomOrAPIKeyConfig = { customUrl: string; apiKey?: undefined } | { customUrl?: undefined; apiKey: string };
type OneInchConfig = { sourceAllowlist?: string[] } & CustomOrAPIKeyConfig;
type OneInchData = { tx: SourceQuoteTransaction };
export class OneInchQuoteSource implements IQuoteSource<OneInchSupport, OneInchConfig, OneInchData> {
  getMetadata() {
    return ONE_INCH_METADATA;
  }

  async quote(params: QuoteParams<OneInchSupport, OneInchConfig>): Promise<SourceQuoteResponse<OneInchData>> {
    const { dstAmount, to, data, value, gas } = await this.getQuote(params);

    const quote = {
      sellAmount: params.request.order.sellAmount,
      buyAmount: BigInt(dstAmount),
      estimatedGas: gas ? BigInt(gas) : undefined,
      allowanceTarget: calculateAllowanceTarget(params.request.sellToken, to),
      customData: {
        tx: {
          to,
          calldata: data,
          value: BigInt(value ?? 0),
        },
      },
    };

    return addQuoteSlippage(quote, params.request.order.type, params.request.config.slippagePercentage);
  }

  async buildTx({ request }: BuildTxParams<OneInchConfig, OneInchData>): Promise<SourceQuoteTransaction> {
    return request.customData.tx;
  }

  private async getQuote({
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
  }: QuoteParams<OneInchSupport, OneInchConfig>) {
    const queryParams = {
      src: sellToken,
      dst: buyToken,
      amount: order.sellAmount.toString(),
      from: takeFrom,
      slippage: slippagePercentage,
      disableEstimate: config.disableValidation,
      receiver: !!recipient && !isSameAddress(takeFrom, recipient) ? recipient : undefined,
      referrer: config.referrer?.address,
      protocols: config.sourceAllowlist,
      includeGas: true,
    };
    const queryString = qs.stringify(queryParams, { skipNulls: true, arrayFormat: 'comma' });
    const url = `${getUrl(config)}/${chain.chainId}/swap?${queryString}`;
    const response = await fetchService.fetch(url, { timeout, headers: getHeaders(config) });
    if (!response.ok) {
      failed(ONE_INCH_METADATA, chain, sellToken, buyToken, (await response.text()) || `Failed with status ${response.status}`);
    }
    const {
      dstAmount,
      tx: { to, data, value, gas },
    } = await response.json();
    return { dstAmount, to, data, value, gas };
  }

  isConfigAndContextValidForQuoting(config: Partial<OneInchConfig> | undefined): config is OneInchConfig {
    return !!config && (!!config.apiKey || !!config.customUrl);
  }

  isConfigAndContextValidForTxBuilding(config: Partial<OneInchConfig> | undefined): config is OneInchConfig {
    return true;
  }
}

function getUrl(config: OneInchConfig) {
  return config.customUrl ?? 'https://api.1inch.dev/swap/v6.0';
}

function getHeaders(config: OneInchConfig) {
  const headers: Record<string, string> = {
    accept: 'application/json',
  };
  if (config.apiKey) {
    headers['Authorization'] = `Bearer ${config.apiKey}`;
  }
  return headers;
}
