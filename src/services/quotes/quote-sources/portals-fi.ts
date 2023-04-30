import { Addresses } from '@shared/constants';
import { PORTALS_FI_CHAIN_ID_TO_KEY, PORTALS_FI_SUPPORTED_CHAINS } from '@shared/portals-fi';
import { isSameAddress } from '@shared/utils';
import { TokenAddress } from '@types';
import { failed } from './utils';
import { AlwaysValidConfigAndContexSource } from './base/always-valid-source';
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
export class PortalsFiQuoteSource extends AlwaysValidConfigAndContexSource<PortalsFiSupport> {
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
    const mappedSellToken = mapNativeToken(sellToken);
    const mappedBuyToken = mapNativeToken(buyToken);
    const chainKey = PORTALS_FI_CHAIN_ID_TO_KEY[chain.chainId];
    let url =
      `https://api.portals.fi/v1/portal/${chainKey}` +
      `?takerAddress=${takeFrom}` +
      `&sellToken=${mappedSellToken}` +
      `&sellAmount=${order.sellAmount.toString()}` +
      `&buyToken=${mappedBuyToken}` +
      `&slippagePercentage=${slippagePercentage / 100}` +
      `&validate=false`;

    if (config.referrer) {
      url += `&partner=${config.referrer.address}`;
    }
    const response = await fetchService.fetch(url, { timeout });
    if (!response.ok) {
      failed(PORTALS_FI_METADATA, chain, sellToken, buyToken, await response.text());
    }
    const {
      context: { buyAmount, minBuyAmount },
      tx: { to, data, value, gasLimit },
    } = await response.json();

    return {
      sellAmount: order.sellAmount,
      maxSellAmount: order.sellAmount,
      buyAmount: BigInt(buyAmount),
      minBuyAmount: BigInt(minBuyAmount),
      type: 'sell',
      estimatedGas: gasLimit ? BigInt(gasLimit) : undefined, // Portals does not estimate gas when validate=false
      allowanceTarget: to,
      tx: {
        to,
        calldata: data,
        value: BigInt(value ?? 0),
      },
    };
  }
}

function mapNativeToken(address: TokenAddress) {
  return isSameAddress(address, Addresses.NATIVE_TOKEN) ? '0x0000000000000000000000000000000000000000' : address;
}
