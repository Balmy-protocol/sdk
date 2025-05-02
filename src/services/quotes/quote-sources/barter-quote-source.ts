import { Chains } from '@chains';
import { Address, ChainId, TimeString } from '@types';
import { calculateDeadline, isSameAddress, subtractPercentage } from '@shared/utils';
import { Addresses } from '@shared/constants';
import { IQuoteSource, QuoteParams, QuoteSourceMetadata, SourceQuoteResponse, SourceQuoteTransaction, BuildTxParams } from './types';
import { calculateAllowanceTarget, checksum, failed } from './utils';

// Supported Networks: https://app.barterswap.xyz/docs/apiv1
const BARTER_NETWORKS: Record<ChainId, string> = {
  [Chains.ETHEREUM.chainId]: 'eth',
  [Chains.ARBITRUM.chainId]: 'arb',
  [Chains.BASE.chainId]: 'base',
  [Chains.GNOSIS.chainId]: 'gn0',
};
const BARTER_METADATA: QuoteSourceMetadata<BarterSupport> = {
  name: 'Barter',
  supports: {
    chains: [Chains.ETHEREUM.chainId, Chains.ARBITRUM.chainId, Chains.BASE.chainId, Chains.GNOSIS.chainId],
    swapAndTransfer: true,
    buyOrders: false,
  },
  logoURI: 'ipfs://QmYhY34jBV93MwZ9xYVrXbcUjg1wL9btspWVoRTQCzxNUx',
};
type BarterSupport = { buyOrders: false; swapAndTransfer: true };
type BarterConfig = ({ sourceAllowlist?: string[]; sourceDenylist?: undefined } | { sourceAllowlist?: undefined; sourceDenylist?: string[] }) & {
  authHeader: string;
};
type BarterData = {
  recipient: Address;
  typeFilters: string[] | undefined;
  txValidFor: TimeString | undefined;
};
export class BarterQuoteSource implements IQuoteSource<BarterSupport, BarterConfig, BarterData> {
  getMetadata() {
    return BARTER_METADATA;
  }

  async quote({
    components: { fetchService },
    request: {
      chainId,
      sellToken,
      buyToken,
      order,
      accounts: { takeFrom, recipient },
      config: { slippagePercentage, timeout, txValidFor },
    },
    config,
  }: QuoteParams<BarterSupport, BarterConfig>): Promise<SourceQuoteResponse<BarterData>> {
    const source = checksumAndMapIfNecessary(sellToken);
    const target = checksumAndMapIfNecessary(buyToken);
    const sellAmount = `${order.sellAmount}`;

    const headers: HeadersInit = { accept: 'application/json', 'Content-Type': 'application/json', Authorization: config.authHeader };
    if (config.referrer?.name) {
      headers['X-From'] = config.referrer.name;
    }
    headers['Authorization'] = `Bearer ${config.authHeader}`;
    const responseEnv = await fetchService.fetch(`https://api2.${BARTER_NETWORKS[chainId]}.barterswap.xyz/env`, {
      headers,
      timeout,
    });
    if (!responseEnv.ok) {
      failed(BARTER_METADATA, chainId, sellToken, buyToken, await responseEnv.text());
    }

    const { default_filters: defaultFilters, facade_address: facadeAddress } = await responseEnv.json();
    const typeFilters = calculateTypeFilters({ config, defaultFilters });

    const responseSwapRoute = await fetchService.fetch(`https://api2.${BARTER_NETWORKS[chainId]}.barterswap.xyz/route`, {
      method: 'POST',
      body: JSON.stringify({ source, target, sellAmount, typeFilters }),
      timeout,
      headers,
    });

    if (!responseSwapRoute.ok) {
      failed(BARTER_METADATA, chainId, sellToken, buyToken, await responseSwapRoute.text());
    }
    const { outputAmount, gasEstimation, status } = await responseSwapRoute.json();
    if (status === 'NoRouteFound') {
      failed(BARTER_METADATA, chainId, sellToken, buyToken, await responseSwapRoute.text());
    }
    const minBuyAmount = subtractPercentage(outputAmount, slippagePercentage, 'up');

    return {
      sellAmount: order.sellAmount,
      maxSellAmount: order.sellAmount,
      type: 'sell',
      buyAmount: BigInt(outputAmount),
      minBuyAmount,
      estimatedGas: BigInt(gasEstimation),
      allowanceTarget: calculateAllowanceTarget(sellToken, facadeAddress),
      customData: { typeFilters, txValidFor, recipient: recipient ?? takeFrom },
    };
  }

  async buildTx({
    components: { fetchService },
    request: {
      chainId,
      sellToken,
      buyToken,
      sellAmount,
      minBuyAmount,
      config: { timeout },
      customData: { typeFilters, txValidFor, recipient },
    },
    config,
  }: BuildTxParams<BarterConfig, BarterData>): Promise<SourceQuoteTransaction> {
    const source = checksumAndMapIfNecessary(sellToken);
    const target = checksumAndMapIfNecessary(buyToken);

    const headers: HeadersInit = { accept: 'application/json', 'Content-Type': 'application/json', Authorization: config.authHeader };
    if (config.referrer?.name) {
      headers['X-From'] = config.referrer.name;
    }
    headers['Authorization'] = `Bearer ${config.authHeader}`;

    const bodySwap = {
      source,
      target,
      sellAmount: `${sellAmount}`,
      deadline: `${calculateDeadline(txValidFor ?? '1h')}`,
      recipient,
      minReturn: `${minBuyAmount}`,
      typeFilters,
    };

    const responseSwap = await fetchService.fetch(`https://api2.${BARTER_NETWORKS[chainId]}.barterswap.xyz/swap`, {
      method: 'POST',
      body: JSON.stringify(bodySwap),
      timeout,
      headers,
    });
    if (!responseSwap.ok) {
      failed(BARTER_METADATA, chainId, sellToken, buyToken, await responseSwap.text());
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
    return !!config?.authHeader;
  }

  isConfigAndContextValidForTxBuilding(config: Partial<BarterConfig> | undefined): config is BarterConfig {
    return !!config?.authHeader;
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
  return isSameAddress(address, Addresses.NATIVE_TOKEN) ? Addresses.ZERO_ADDRESS : checksum(address);
}
