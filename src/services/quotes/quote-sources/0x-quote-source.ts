import qs from 'qs';
import { Chains } from '@chains';
import { Addresses } from '@shared/constants';
import { IQuoteSource, QuoteParams, QuoteSourceMetadata, SourceQuoteResponse, SourceQuoteTransaction, BuildTxParams } from './types';
import { calculateAllowanceTarget, failed } from './utils';

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
];

const ZRX_METADATA: QuoteSourceMetadata<ZRXSupport> = {
  name: '0x/Matcha',
  supports: {
    chains: SUPPORTED_CHAINS.map((chain) => chain.chainId),
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
      sellAmount: order.sellAmount.toString(),
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
    const {
      transaction: { data, gas, to, value },
      buyAmount,
      minBuyAmount,
      issues,
    } = await response.json();

    const allowanceTarget = issues?.allowance?.spender ?? Addresses.ZERO_ADDRESS;

    return {
      sellAmount: order.sellAmount,
      maxSellAmount: order.sellAmount,
      buyAmount: BigInt(buyAmount),
      minBuyAmount: BigInt(minBuyAmount),
      estimatedGas: BigInt(gas ?? 0),
      allowanceTarget: calculateAllowanceTarget(sellToken, allowanceTarget),
      customData: {
        tx: {
          calldata: data,
          to,
          value: BigInt(value ?? 0),
        },
      },
      type: order.type,
    };
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
