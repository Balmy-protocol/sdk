import { Chains } from '@chains';
import { Chain, Address } from '@types';
import { Addresses } from '@shared/constants';
import { IQuoteSource, QuoteParams, QuoteSourceMetadata, QuoteSourceSupport, SourceQuoteRequest, SourceQuoteResponse } from './types';
import { addQuoteSlippage, failed } from './utils';
import { isSameAddress } from '@shared/utils';
import { DEFAULT_SWAP_ROUTES, SmartRouter, smartRoutes } from '@sovryn/sdk';
import { AlwaysValidConfigAndContextSource } from './base/always-valid-source';

export const SOVRYN_METADATA: QuoteSourceMetadata<SovrynSupport> = {
  name: 'Sovryn',
  supports: {
    chains: [Chains.ROOTSTOCK.chainId],
    swapAndTransfer: false,
    buyOrders: false,
  },
  logoURI: 'ipfs://QmUpdb1zxtB2kUSjR1Qs1QMFPsSeZNkL21fMzGUfdjkXQA',
};

type SovrynSupport = { buyOrders: false; swapAndTransfer: false };
export class SovrynQuoteSource extends AlwaysValidConfigAndContextSource<SovrynSupport> {
  getMetadata() {
    return SOVRYN_METADATA;
  }

  async quote({
    components: { providerService },
    request: {
      chain,
      sellToken,
      buyToken,
      order,
      accounts: { takeFrom },
      config: { slippagePercentage },
    },
  }: QuoteParams<SovrynSupport>): Promise<SourceQuoteResponse> {
    // Get Rootstock provider
    const provider = providerService.getEthersProvider({ chainId: Chains.ROOTSTOCK.chainId });
    // Create smart router
    // FIX: Enable routes ZeroRedemption, MoC and Mynt once they enable it's use without permit.
    const smartRouter = new SmartRouter(provider, Object.values([smartRoutes.ammSwapRoute]));
    // Find best quote
    try {
      const result = await smartRouter.getBestQuote(mapNativeToken(sellToken), mapNativeToken(buyToken), order.sellAmount);
      // Get swap tx data
      const swapTxData = await result.route.swap(mapNativeToken(sellToken), mapNativeToken(buyToken), order.sellAmount, takeFrom, {
        slippage: 500,
      });

      const swapData = swapTxData.data!.toString();

      const quote = {
        sellAmount: order.sellAmount,
        buyAmount: BigInt(result.quote.toString()),
        // FIX: Once the SDK starts exposing the allowance target, use that
        allowanceTarget: calculateAllowanceTarget(sellToken, swapTxData?.to || Addresses.ZERO_ADDRESS),
        tx: {
          to: swapTxData.to!,
          calldata: swapData,
          value: isSameAddress(sellToken, Addresses.NATIVE_TOKEN) ? order.sellAmount : 0n,
        },
      };
      return addQuoteSlippage(quote, order.type, slippagePercentage);
    } catch (error: any) {
      failed(SOVRYN_METADATA, chain, sellToken, buyToken, error.message);
    }
  }
}

function mapNativeToken(address: Address) {
  return isSameAddress(address, Addresses.NATIVE_TOKEN) ? Addresses.ZERO_ADDRESS : address;
}

function calculateAllowanceTarget(sellToken: Address, allowanceTarget: Address) {
  return isSameAddress(sellToken, Addresses.NATIVE_TOKEN) ? Addresses.ZERO_ADDRESS : allowanceTarget;
}
