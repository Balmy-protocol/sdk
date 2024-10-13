import qs from 'qs';
import { Chains } from '@chains';
import { isSameAddress } from '@shared/utils';
import { IQuoteSource, QuoteParams, QuoteSourceMetadata, SourceQuoteResponse, SourceQuoteTransaction, BuildTxParams } from './types';
import { addQuoteSlippage, calculateAllowanceTarget, failed } from './utils';

// Supported Networks: https://0x.org/docs/0x-swap-api/introduction#supported-networks
const SUPPORTED_CHAINS = [
  Chains.ETHEREUM,
  Chains.ARBITRUM,
  Chains.AVALANCHE,
  Chains.BASE,
  Chains.BLAST,
  Chains.BNB_CHAIN,
  Chains.LINEA,
  Chains.OPTIMISM,
  Chains.POLYGON,
  Chains.SCROLL,
].map((chain) => chain.chainId);

const ZRX_METADATA: QuoteSourceMetadata<ZRXSupport> = {
  name: '0x/Matcha',
  supports: {
    chains: SUPPORTED_CHAINS,
    swapAndTransfer: false,
    buyOrders: false,
  },
  logoURI: 'ipfs://QmPQY4siKEJHZGW5F4JDBrUXCBFqfpnKzPA2xDmboeuZzL',
};
type ZRXConfig = { apiKey: string };
type ZRXSupport = { buyOrders: false; swapAndTransfer: false };
type ZRXData = { tx: SourceQuoteTransaction };
export class ZRXQuoteSource implements IQuoteSource<ZRXSupport, ZRXConfig, ZRXData> {
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
  }: QuoteParams<ZRXSupport, ZRXConfig>): Promise<SourceQuoteResponse<ZRXData>> {
    const queryParams = {
      chainId: chain.chainId,
      sellToken,
      buyToken,
      taker: takeFrom,
      slippageBps: slippagePercentage * 100,
      affiliateAddress: config.referrer?.address,
      sellAmount: order.type === 'sell' ? order.sellAmount.toString() : undefined,
    };
    const queryString = qs.stringify(queryParams, { skipNulls: true, arrayFormat: 'comma' });
    const url = `https://api.0x.org/swap/allowance-holder/quote?${queryString}`;

    const headers: HeadersInit = {
      '0x-api-key': config.apiKey,
      '0x-version': 'v2',
    };

    const response = await fetchService.fetch(url, { timeout, headers });
    if (!response.ok) {
      failed(ZRX_METADATA, chain, sellToken, buyToken, await response.text());
    }
    const lala = await response.json();
    const { data, buyAmount, sellAmount, to, allowanceTarget, estimatedGas, value } = lala;

    const quote = {
      sellAmount: BigInt(sellAmount),
      buyAmount: BigInt(buyAmount),
      estimatedGas: BigInt(estimatedGas),
      allowanceTarget: calculateAllowanceTarget(sellToken, allowanceTarget),
      customData: {
        tx: {
          calldata: data,
          to,
          value: BigInt(value ?? 0),
        },
      },
    };

    return addQuoteSlippage(quote, order.type, isSameAddress(to, chain.wToken) ? 0 : slippagePercentage);
  }

  async buildTx({ request }: BuildTxParams<ZRXConfig, ZRXData>): Promise<SourceQuoteTransaction> {
    return request.customData.tx;
  }

  isConfigAndContextValidForQuoting(config: Partial<ZRXConfig> | undefined): config is ZRXConfig {
    return !!config?.apiKey;
  }

  isConfigAndContextValidForTxBuilding(config: Partial<ZRXConfig> | undefined): config is ZRXConfig {
    return true;
  }
}
