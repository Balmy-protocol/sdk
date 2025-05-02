import qs from 'qs';
import { Chains } from '@chains';
import { formatUnits } from 'viem';
import { QuoteParams, QuoteSourceMetadata, SourceQuoteResponse, SourceQuoteTransaction, BuildTxParams } from './types';
import { calculateAllowanceTarget, failed } from './utils';
import { GasPrice } from '@services/gas/types';
import { Address, ChainId } from '@types';
import { AlwaysValidConfigAndContextSource } from './base/always-valid-source';
import { Addresses } from '@shared/constants';
import { isSameAddress } from '@shared/utils';

// Supported Networks: https://apis.openocean.finance/developer/developer-resources/supported-chains
const SUPPORTED_CHAINS: Record<ChainId, { chainKey: string; nativeAsset?: Address }> = {
  [Chains.ETHEREUM.chainId]: { chainKey: 'eth' },
  [Chains.BNB_CHAIN.chainId]: { chainKey: 'bsc' },
  [Chains.POLYGON.chainId]: { chainKey: 'polygon', nativeAsset: '0x0000000000000000000000000000000000001010' },
  [Chains.BASE.chainId]: { chainKey: 'base' },
  [Chains.LINEA.chainId]: { chainKey: 'linea' },
  [Chains.FANTOM.chainId]: { chainKey: 'fantom', nativeAsset: '0x0000000000000000000000000000000000000000' },
  [Chains.AVALANCHE.chainId]: { chainKey: 'avax', nativeAsset: '0x0000000000000000000000000000000000000000' },
  [Chains.ARBITRUM.chainId]: { chainKey: 'arbitrum' },
  [Chains.OPTIMISM.chainId]: { chainKey: 'optimism' },
  [Chains.MOONRIVER.chainId]: { chainKey: 'moonriver' },
  [Chains.AURORA.chainId]: { chainKey: 'aurora' },
  [Chains.CRONOS.chainId]: { chainKey: 'cronos', nativeAsset: '0x0000000000000000000000000000000000000000' },
  [Chains.HARMONY_SHARD_0.chainId]: { chainKey: 'harmony' },
  [Chains.KAVA.chainId]: { chainKey: 'kava' },
  [Chains.METIS_ANDROMEDA.chainId]: { chainKey: 'metis', nativeAsset: '0xdeaddeaddeaddeaddeaddeaddeaddeaddead0000' },
  [Chains.CELO.chainId]: { chainKey: 'celo', nativeAsset: '0x471ece3750da237f93b8e339c536989b8978a438' },
  [Chains.POLYGON_ZKEVM.chainId]: { chainKey: 'polygon_zkevm' },
  [Chains.ONTOLOGY.chainId]: { chainKey: 'ontvm' },
  [Chains.GNOSIS.chainId]: { chainKey: 'xdai', nativeAsset: '0x0000000000000000000000000000000000000000' },
  [Chains.opBNB.chainId]: { chainKey: 'opbnb' },
  [Chains.BLAST.chainId]: { chainKey: 'blast' },
  [Chains.ROOTSTOCK.chainId]: { chainKey: 'rootstock' },
  [Chains.MODE.chainId]: { chainKey: 'mode' },
  [Chains.ZK_SYNC_ERA.chainId]: { chainKey: 'zksync' },
  [Chains.SCROLL.chainId]: { chainKey: 'scroll' },
  [Chains.MANTLE.chainId]: { chainKey: 'mantle', nativeAsset: '0x0000000000000000000000000000000000000000' },
  [Chains.SONIC.chainId]: { chainKey: 'sonic', nativeAsset: '0x0000000000000000000000000000000000000000' },
};

const OPEN_OCEAN_METADATA: QuoteSourceMetadata<OpenOceanSupport> = {
  name: 'Open Ocean',
  supports: {
    chains: Object.keys(SUPPORTED_CHAINS).map(Number),
    swapAndTransfer: true,
    buyOrders: false,
  },
  logoURI: 'ipfs://QmP7bVENjMmobmjJcPFX6VbFTmj6pKmFNqv7Qkyqui44dT',
};
type OpenOceanSupport = { buyOrders: false; swapAndTransfer: true };
type OpenOceanConfig = { sourceAllowlist?: string[]; apiKey?: string };
type OpenOceanData = { tx: SourceQuoteTransaction };
export class OpenOceanQuoteSource extends AlwaysValidConfigAndContextSource<OpenOceanSupport, OpenOceanConfig, OpenOceanData> {
  getMetadata() {
    return OPEN_OCEAN_METADATA;
  }

  async quote({
    components: { fetchService },
    request: {
      chainId,
      sellToken,
      buyToken,
      order,
      accounts: { takeFrom, recipient },
      config: { slippagePercentage, timeout },
      external,
    },
    config,
  }: QuoteParams<OpenOceanSupport, OpenOceanConfig>): Promise<SourceQuoteResponse<OpenOceanData>> {
    const [{ sellToken: sellTokenDataResult }, gasPriceResult] = await Promise.all([external.tokenData.request(), external.gasPrice.request()]);
    const legacyGasPrice = eip1159ToLegacy(gasPriceResult);
    const gasPrice = parseFloat(formatUnits(legacyGasPrice, 9));
    const amount = formatUnits(order.sellAmount, sellTokenDataResult.decimals);
    const { chainKey, nativeAsset } = SUPPORTED_CHAINS[chainId];
    const native = nativeAsset ?? Addresses.NATIVE_TOKEN;
    const queryParams = {
      inTokenAddress: isSameAddress(sellToken, Addresses.NATIVE_TOKEN) ? native : sellToken,
      outTokenAddress: isSameAddress(buyToken, Addresses.NATIVE_TOKEN) ? native : buyToken,
      amount: amount,
      slippage: slippagePercentage,
      gasPrice: gasPrice,
      account: recipient ?? takeFrom,
      referrer: config.referrer?.address,
      enabledDexIds: config.sourceAllowlist,
    };
    const queryString = qs.stringify(queryParams, { skipNulls: true, arrayFormat: 'comma' });
    const url = `https://open-api.openocean.finance/v3/${chainKey}/swap_quote?${queryString}`;
    const headers: Record<string, string> = {};
    if (config.apiKey) {
      headers['apikey'] = config.apiKey;
    }
    const response = await fetchService.fetch(url, { timeout, headers });
    if (!response.ok) {
      failed(OPEN_OCEAN_METADATA, chainId, sellToken, buyToken, await response.text());
    }
    const {
      data: { outAmount, estimatedGas, minOutAmount, to, value, data },
    } = await response.json();

    return {
      sellAmount: order.sellAmount,
      maxSellAmount: order.sellAmount,
      buyAmount: BigInt(outAmount),
      minBuyAmount: BigInt(minOutAmount),
      type: 'sell',
      estimatedGas: BigInt(estimatedGas),
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

  async buildTx({ request }: BuildTxParams<OpenOceanConfig, OpenOceanData>): Promise<SourceQuoteTransaction> {
    return request.customData.tx;
  }
}

function eip1159ToLegacy(gasPrice: GasPrice): bigint {
  if ('gasPrice' in gasPrice) {
    return BigInt(gasPrice.gasPrice);
  }
  return BigInt(gasPrice.maxFeePerGas);
}
