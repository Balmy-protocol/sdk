import { Chains } from '@chains';
import { Address, Chain, TimeString } from '@types';
import { IFetchService } from '@services/fetch';
import { calculateDeadline, isSameAddress, substractPercentage } from '@shared/utils';
import { Addresses } from '@shared/constants';
import { QuoteParams, QuoteSourceMetadata, SourceQuoteResponse } from './types';
import { calculateAllowanceTarget, checksum, failed } from './utils';
import { AlwaysValidConfigAndContextSource } from './base/always-valid-source';

const BARTER_METADATA: QuoteSourceMetadata<BarterSupport> = {
  name: 'Barter',
  supports: {
    chains: [Chains.ETHEREUM.chainId],
    swapAndTransfer: true,
    buyOrders: false,
  },
  // TODO: Update
  logoURI: 'ipfs://QmPQY4siKEJHZGW5F4JDBrUXCBFqfpnKzPA2xDmboeuZzL',
};
type BarterSupport = { buyOrders: false; swapAndTransfer: true };
type BarterConfig = { sourceAllowlist?: string[]; sourceDenylist?: undefined } | { sourceAllowlist?: undefined; sourceDenylist?: string[] };
export class BarterQuoteSource extends AlwaysValidConfigAndContextSource<BarterSupport, BarterConfig> {
  getMetadata() {
    return BARTER_METADATA;
  }

  async quote({
    components: { fetchService },
    request: {
      chain,
      sellToken,
      buyToken,
      order,
      config: { slippagePercentage, timeout, txValidFor },
      accounts: { takeFrom, recipient },
    },
    config,
  }: QuoteParams<BarterSupport, BarterConfig>): Promise<SourceQuoteResponse> {
    const source = checksumAndMapIfNecessary(sellToken);
    const target = checksumAndMapIfNecessary(buyToken);
    const amount = `${order.sellAmount}`;

    const headers: HeadersInit = { accept: 'application/json', ['Content-Type']: 'application/json' };
    if (config.referrer?.name) {
      headers['X-From'] = config.referrer.name;
    }

    const typeFiltersPromise = calculateTypeFilters({ config, fetchService, chain, sellToken, buyToken, headers, timeout });
    const swapRoutePromise = fetchService.fetch('https://api.barterswap.xyz/getSwapRoute', {
      method: 'POST',
      // Note: we won't apply the type filter here, so that we can parallelize the quote and speed things up
      body: JSON.stringify({ source, target, amount }),
      timeout,
      headers,
    });

    const [responseSwapRoute, typeFilter] = await Promise.all([swapRoutePromise, typeFiltersPromise]);
    if (!responseSwapRoute.ok) {
      failed(BARTER_METADATA, chain, sellToken, buyToken, await responseSwapRoute.text());
    }
    const resultSwapRoute = await responseSwapRoute.json();
    const minBuyAmount = substractPercentage(resultSwapRoute.outputAmount, slippagePercentage, 'up');

    const bodySwap = {
      source,
      target,
      amount,
      deadline: `${calculateDeadline(txValidFor ?? '1h')}`,
      recipient: recipient ?? takeFrom,
      targetTokenMinReturn: `${minBuyAmount}`,
      typeFilter,
    };

    const responseSwap = await fetchService.fetch('https://api.barterswap.xyz/swap', {
      method: 'POST',
      body: JSON.stringify(bodySwap),
      timeout,
      headers,
    });
    if (!responseSwap.ok) {
      failed(BARTER_METADATA, chain, sellToken, buyToken, await responseSwap.text());
    }
    const resultSwap = await responseSwap.json();
    const {
      data,
      to,
      value,
      route: { gasEstimation, outputAmount },
    } = resultSwap;

    return {
      sellAmount: order.sellAmount,
      maxSellAmount: order.sellAmount,
      type: 'sell',
      buyAmount: BigInt(outputAmount),
      minBuyAmount,
      estimatedGas: BigInt(gasEstimation),
      allowanceTarget: calculateAllowanceTarget(sellToken, to),
      tx: {
        calldata: data,
        to,
        value: BigInt(value ?? 0),
      },
    };
  }
}

async function calculateTypeFilters({
  config,
  fetchService,
  headers,
  chain,
  sellToken,
  buyToken,
  timeout,
}: {
  config: BarterConfig;
  fetchService: IFetchService;
  headers: HeadersInit;
  chain: Chain;
  sellToken: Address;
  buyToken: Address;
  timeout: TimeString | undefined;
}) {
  if (config.sourceAllowlist) {
    return config.sourceAllowlist;
  } else if (config.sourceDenylist) {
    const response = await fetchService.fetch('https://api.barterswap.xyz/env', { headers, timeout });
    if (!response.ok) {
      failed(BARTER_METADATA, chain, sellToken, buyToken, await response.text());
    }
    const { defaultFilters }: { defaultFilters: string[] } = await response.json();
    const lowerDenylist = new Set(config.sourceDenylist!.map((source) => source.toLowerCase()));
    return defaultFilters.filter((filter) => !lowerDenylist.has(filter.toLowerCase()));
  }
  return undefined;
}

function checksumAndMapIfNecessary(address: Address) {
  return isSameAddress(address, Addresses.NATIVE_TOKEN) ? '0x0000000000000000000000000000000000000000' : checksum(address);
}
