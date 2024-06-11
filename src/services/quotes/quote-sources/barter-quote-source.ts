import { Chains } from '@chains';
import { Address, ChainId, TimeString } from '@types';
import { calculateDeadline, isSameAddress, subtractPercentage } from '@shared/utils';
import { Addresses } from '@shared/constants';
import { IQuoteSource, QuoteParams, QuoteSourceMetadata, SourceQuoteResponse, SourceQuoteTransaction, BuildTxParams } from './types';
import { calculateAllowanceTarget, checksum, failed } from './utils';

const BARTER_NETWORKS: Record<ChainId, string> = {
  [Chains.ETHEREUM.chainId]: 'eth',
  [Chains.ARBITRUM.chainId]: 'arb',
};
const BARTER_METADATA: QuoteSourceMetadata<BarterSupport> = {
  name: 'Barter',
  supports: {
    chains: [Chains.ETHEREUM.chainId],
    swapAndTransfer: true,
    buyOrders: false,
  },
  logoURI: 'ipfs://QmYhY34jBV93MwZ9xYVrXbcUjg1wL9btspWVoRTQCzxNUx',
};
type BarterSupport = { buyOrders: false; swapAndTransfer: true };
type BarterConfig = ({ sourceAllowlist?: string[]; sourceDenylist?: undefined } | { sourceAllowlist?: undefined; sourceDenylist?: string[] }) & {
  authHeader: string;
  customSubdomain: string;
};
type BarterData = {
  typeFilter: string[] | undefined;
  txValidFor: TimeString | undefined;
};
export class BarterQuoteSource implements IQuoteSource<BarterSupport, BarterConfig, BarterData> {
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
    },
    config,
  }: QuoteParams<BarterSupport, BarterConfig>): Promise<SourceQuoteResponse<BarterData>> {
    const source = checksumAndMapIfNecessary(sellToken);
    const target = checksumAndMapIfNecessary(buyToken);
    const amount = `${order.sellAmount}`;

    const headers: HeadersInit = { accept: 'application/json', 'Content-Type': 'application/json', Authorization: config.authHeader };
    if (config.referrer?.name) {
      headers['X-From'] = config.referrer.name;
    }

    const responseEnv = await fetchService.fetch(`https://${config.customSubdomain}.${BARTER_NETWORKS[chain.chainId]}.barterswap.xyz/env`, {
      headers,
      timeout,
    });
    if (!responseEnv.ok) {
      failed(BARTER_METADATA, chain, sellToken, buyToken, await responseEnv.text());
    }

    const { defaultFilters, facadeAddress } = await responseEnv.json();
    const typeFilter = calculateTypeFilters({ config, defaultFilters });

    const responseSwapRoute = await fetchService.fetch(
      `https://${config.customSubdomain}.${BARTER_NETWORKS[chain.chainId]}.barterswap.xyz/getSwapRoute`,
      {
        method: 'POST',
        body: JSON.stringify({ source, target, amount, typeFilter }),
        timeout,
        headers,
      }
    );

    if (!responseSwapRoute.ok) {
      failed(BARTER_METADATA, chain, sellToken, buyToken, await responseSwapRoute.text());
    }
    const { outputAmount, gasEstimation } = await responseSwapRoute.json();
    const minBuyAmount = subtractPercentage(outputAmount, slippagePercentage, 'up');

    return {
      sellAmount: order.sellAmount,
      maxSellAmount: order.sellAmount,
      type: 'sell',
      buyAmount: BigInt(outputAmount),
      minBuyAmount,
      estimatedGas: BigInt(gasEstimation),
      allowanceTarget: calculateAllowanceTarget(sellToken, facadeAddress),
      customData: { typeFilter, txValidFor },
    };
  }

  async buildTx({
    components: { fetchService },
    request: {
      chain,
      sellToken,
      buyToken,
      sellAmount,
      minBuyAmount,
      config: { timeout },
      accounts: { recipient },
      customData: { typeFilter, txValidFor },
    },
    config,
  }: BuildTxParams<BarterConfig, BarterData>): Promise<SourceQuoteTransaction> {
    const source = checksumAndMapIfNecessary(sellToken);
    const target = checksumAndMapIfNecessary(buyToken);
    const amount = `${sellAmount}`;

    const headers: HeadersInit = { accept: 'application/json', 'Content-Type': 'application/json', Authorization: config.authHeader };
    if (config.referrer?.name) {
      headers['X-From'] = config.referrer.name;
    }

    const bodySwap = {
      source,
      target,
      amount,
      deadline: `${calculateDeadline(txValidFor ?? '1h')}`,
      recipient,
      targetTokenMinReturn: `${minBuyAmount}`,
      typeFilter,
    };

    const responseSwap = await fetchService.fetch(`https://${config.customSubdomain}.${BARTER_NETWORKS[chain.chainId]}.barterswap.xyz/swap`, {
      method: 'POST',
      body: JSON.stringify(bodySwap),
      timeout,
      headers,
    });
    if (!responseSwap.ok) {
      failed(BARTER_METADATA, chain, sellToken, buyToken, await responseSwap.text());
    }
    const resultSwap = await responseSwap.json();
    const { data, to, value } = resultSwap;

    return {
      calldata: data,
      to,
      value: BigInt(value ?? 0),
    };
  }

  isConfigAndContextValidForQuoting(config: Partial<BarterConfig> | undefined): config is BarterConfig {
    return !!config?.authHeader && !!config?.customSubdomain;
  }

  isConfigAndContextValidForTxBuilding(config: Partial<BarterConfig> | undefined): config is BarterConfig {
    return !!config?.authHeader && !!config?.customSubdomain;
  }
}

function calculateTypeFilters({ config, defaultFilters }: { config: BarterConfig; defaultFilters: string[] }) {
  if (config.sourceAllowlist) {
    return config.sourceAllowlist;
  } else if (config.sourceDenylist) {
    const lowerDenylist = new Set(config.sourceDenylist!.map((source) => source.toLowerCase()));
    return defaultFilters.filter((filter) => !lowerDenylist.has(filter.toLowerCase()));
  }
  return undefined;
}

function checksumAndMapIfNecessary(address: Address) {
  return isSameAddress(address, Addresses.NATIVE_TOKEN) ? '0x0000000000000000000000000000000000000000' : checksum(address);
}
