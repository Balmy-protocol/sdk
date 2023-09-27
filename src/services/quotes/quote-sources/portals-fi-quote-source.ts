import { Addresses } from '@shared/constants';
import { PORTALS_FI_CHAIN_ID_TO_KEY, PORTALS_FI_SUPPORTED_CHAINS } from '@shared/portals-fi';
import { isSameAddress } from '@shared/utils';
import { Chain, TokenAddress } from '@types';
import { calculateAllowanceTarget, failed } from './utils';
import { AlwaysValidConfigAndContextSource } from './base/always-valid-source';
import { QuoteParams, QuoteSourceMetadata, SourceQuoteResponse } from './types';

export const PORTALS_FI_METADATA: QuoteSourceMetadata<PortalsFiSupport> = {
  name: 'Portals.fi',
  supports: {
    chains: PORTALS_FI_SUPPORTED_CHAINS,
    swapAndTransfer: false,
    buyOrders: false,
  },
  logoURI: 'ipfs://QmYJiiZAxFHSJb37y25unRUyWioTH6odKWmEZ1psD1DyuL',
};
type PortalsFiSupport = { buyOrders: false; swapAndTransfer: false };
export class PortalsFiQuoteSource extends AlwaysValidConfigAndContextSource<PortalsFiSupport> {
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
  }: QuoteParams<PortalsFiSupport>): Promise<SourceQuoteResponse> {
    const mappedSellToken = mapToken(chain, sellToken);
    const mappedBuyToken = mapToken(chain, buyToken);
    let url =
      `https://api.portals.fi/v2/portal` +
      `?sender=${takeFrom}` +
      `&inputToken=${mappedSellToken}` +
      `&inputAmount=${order.sellAmount.toString()}` +
      `&outputToken=${mappedBuyToken}` +
      `&slippageTolerancePercentage=${slippagePercentage}` +
      `&validate=false`;

    if (config.referrer) {
      url += `&feePercentage=0`;
      url += `&partner=${config.referrer.address}`;
    }
    const response = await fetchService.fetch(url, { timeout });
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
      tx: {
        to,
        calldata: data,
        value: BigInt(value ?? 0),
      },
    };
  }
}

function mapToken(chain: Chain, address: TokenAddress) {
  const chainKey = PORTALS_FI_CHAIN_ID_TO_KEY[chain.chainId];
  const mapped = isSameAddress(address, Addresses.NATIVE_TOKEN) ? Addresses.ZERO_ADDRESS : address;
  return `${chainKey}:${mapped}`;
}
