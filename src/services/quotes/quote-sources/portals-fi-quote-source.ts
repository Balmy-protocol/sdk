import qs from 'qs';
import { Addresses } from '@shared/constants';
import { isSameAddress } from '@shared/utils';
import { Chain, ChainId, TokenAddress } from '@types';
import { calculateAllowanceTarget, failed } from './utils';
import { IQuoteSource, QuoteParams, QuoteSourceMetadata, SourceQuoteResponse, SourceQuoteTransaction, BuildTxParams } from './types';
import { Chains } from '@chains';

const PORTALS_FI_CHAIN_ID_TO_KEY: Record<ChainId, string> = {
  [Chains.ETHEREUM.chainId]: 'ethereum',
  [Chains.OPTIMISM.chainId]: 'optimism',
  [Chains.FANTOM.chainId]: 'fantom',
  [Chains.ARBITRUM.chainId]: 'arbitrum',
  [Chains.POLYGON.chainId]: 'polygon',
  [Chains.AVALANCHE.chainId]: 'avalanche',
  [Chains.BNB_CHAIN.chainId]: 'bsc',
  [Chains.BASE.chainId]: 'base',
};

export const PORTALS_FI_METADATA: QuoteSourceMetadata<PortalsFiSupport> = {
  name: 'Portals.fi',
  supports: {
    chains: Object.keys(PORTALS_FI_CHAIN_ID_TO_KEY).map(Number),
    swapAndTransfer: false,
    buyOrders: false,
  },
  logoURI: 'ipfs://QmYJiiZAxFHSJb37y25unRUyWioTH6odKWmEZ1psD1DyuL',
};
type PortalsFiConfig = { apiKey: string };
type PortalsFiSupport = { buyOrders: false; swapAndTransfer: false };
type PortalsFiData = { tx: SourceQuoteTransaction };
export class PortalsFiQuoteSource implements IQuoteSource<PortalsFiSupport, PortalsFiConfig, PortalsFiData> {
  getMetadata() {
    return PORTALS_FI_METADATA;
  }

  async quote({
    components: { fetchService },
    request: {
      chain,
      sellToken,
      buyToken,
      order,
      accounts: { takeFrom },
      config: { slippagePercentage, timeout },
    },
    config,
  }: QuoteParams<PortalsFiSupport, PortalsFiConfig>): Promise<SourceQuoteResponse<PortalsFiData>> {
    const mappedSellToken = mapToken(chain, sellToken);
    const mappedBuyToken = mapToken(chain, buyToken);
    const queryParams = {
      sender: takeFrom,
      inputToken: mappedSellToken,
      inputAmount: order.sellAmount.toString(),
      outputToken: mappedBuyToken,
      slippageTolerancePercentage: slippagePercentage,
      validate: !config.disableValidation,
      partner: config.referrer?.address,
      feePercentage: config.referrer ? 0 : undefined,
    };
    const queryString = qs.stringify(queryParams, { skipNulls: true, arrayFormat: 'comma' });
    const url = `https://api.portals.fi/v2/portal?${queryString}`;
    const key = config.apiKey.startsWith('Bearer ') ? config.apiKey : `Bearer ${config.apiKey}`;
    const response = await fetchService.fetch(url, {
      timeout,
      headers: { Authorization: key },
    });
    if (!response.ok) {
      failed(PORTALS_FI_METADATA, chain, sellToken, buyToken, await response.text());
    }
    const {
      context: { outputAmount, minOutputAmount, value },
      tx: { to, data, gasLimit },
    } = await response.json();

    return {
      sellAmount: order.sellAmount,
      maxSellAmount: order.sellAmount,
      buyAmount: BigInt(outputAmount),
      minBuyAmount: BigInt(minOutputAmount),
      type: 'sell',
      estimatedGas: gasLimit ? BigInt(gasLimit) : undefined, // Portals does not estimate gas when validate=false
      allowanceTarget: calculateAllowanceTarget(sellToken, to),
      customData: {
        tx: {
          to,
          calldata: data,
          value: BigInt(value ?? 0),
        },
      },
    };
  }

  async buildTx({ request }: BuildTxParams<PortalsFiConfig, PortalsFiData>): Promise<SourceQuoteTransaction> {
    return request.customData.tx;
  }

  isConfigAndContextValidForQuoting(config: Partial<PortalsFiConfig> | undefined): config is PortalsFiConfig {
    return !!config?.apiKey;
  }

  isConfigAndContextValidForTxBuilding(config: Partial<PortalsFiConfig> | undefined): config is PortalsFiConfig {
    return true;
  }
}

function mapToken(chain: Chain, address: TokenAddress) {
  const chainKey = PORTALS_FI_CHAIN_ID_TO_KEY[chain.chainId];
  const mapped = isSameAddress(address, Addresses.NATIVE_TOKEN) ? Addresses.ZERO_ADDRESS : address;
  return `${chainKey}:${mapped}`;
}
