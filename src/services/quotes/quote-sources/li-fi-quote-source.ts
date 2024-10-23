import { Chains } from '@chains';
import { Addresses } from '@shared/constants';
import { isSameAddress } from '@shared/utils';
import { TokenAddress } from '@types';
import { AlwaysValidConfigAndContextSource } from './base/always-valid-source';
import { QuoteParams, QuoteSourceMetadata, SourceQuoteResponse, SourceQuoteTransaction, BuildTxParams } from './types';
import { calculateAllowanceTarget, failed } from './utils';

// Supported networks: https://li.quest/v1/chains
const LI_FI_METADATA: QuoteSourceMetadata<LiFiSupport> = {
  name: 'LI.FI',
  supports: {
    chains: [
      Chains.ETHEREUM.chainId,
      Chains.POLYGON.chainId,
      Chains.BNB_CHAIN.chainId,
      Chains.GNOSIS.chainId,
      Chains.FANTOM.chainId,
      Chains.OKC.chainId,
      Chains.AVALANCHE.chainId,
      Chains.ARBITRUM.chainId,
      Chains.OPTIMISM.chainId,
      Chains.MOONRIVER.chainId,
      Chains.MOONBEAM.chainId,
      Chains.CELO.chainId,
      Chains.FUSE.chainId,
      Chains.CRONOS.chainId,
      Chains.VELAS.chainId,
      Chains.AURORA.chainId,
      Chains.EVMOS.chainId,
      Chains.POLYGON_ZKEVM.chainId,
      Chains.BASE.chainId,
      Chains.ROOTSTOCK.chainId,
      Chains.MODE.chainId,
      Chains.LINEA.chainId,
      Chains.BOBA.chainId,
      Chains.METIS_ANDROMEDA.chainId,
      Chains.SCROLL.chainId,
      Chains.BLAST.chainId,
    ],
    swapAndTransfer: true,
    buyOrders: false,
  },
  logoURI: 'ipfs://QmUgcnaNxsgQdjBjytxvXfeSfsDryh9bF4mNaz1Bp5QwJ4',
};
type LiFiConfig = { apiKey?: string };
type LiFiSupport = { buyOrders: false; swapAndTransfer: true };
type LiFiData = { tx: SourceQuoteTransaction };
export class LiFiQuoteSource extends AlwaysValidConfigAndContextSource<LiFiSupport, LiFiConfig> {
  getMetadata() {
    return LI_FI_METADATA;
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
    },
    config,
  }: QuoteParams<LiFiSupport, LiFiConfig>): Promise<SourceQuoteResponse<LiFiData>> {
    const mappedSellToken = mapNativeToken(sellToken);
    const mappedBuyToken = mapNativeToken(buyToken);
    let url =
      `https://li.quest/v1/quote` +
      `?fromChain=${chainId}` +
      `&toChain=${chainId}` +
      `&fromToken=${mappedSellToken}` +
      `&toToken=${mappedBuyToken}` +
      `&fromAddress=${takeFrom}` +
      `&toAddress=${recipient ?? takeFrom}` +
      `&fromAmount=${order.sellAmount.toString()}` +
      `&slippage=${slippagePercentage / 100}`;

    if (config.referrer) {
      url += `&integrator=${config.referrer.name}`;
      url += `&referrer=${config.referrer.address}`;
    }
    const headers: Record<string, string> = {};
    if (config.apiKey) {
      headers['x-lifi-api-key'] = config.apiKey;
    }
    const response = await fetchService.fetch(url, { timeout, headers });
    if (!response.ok) {
      failed(LI_FI_METADATA, chainId, sellToken, buyToken, await response.text());
    }
    const {
      estimate: { approvalAddress, toAmountMin, toAmount, gasCosts },
      transactionRequest: { to, data, value },
    } = await response.json();

    const estimatedGas = (gasCosts as { estimate: bigint }[]).reduce((accum, { estimate }) => accum + BigInt(estimate), 0n);

    return {
      sellAmount: order.sellAmount,
      maxSellAmount: order.sellAmount,
      buyAmount: BigInt(toAmount),
      minBuyAmount: BigInt(toAmountMin),
      type: 'sell',
      estimatedGas,
      allowanceTarget: calculateAllowanceTarget(sellToken, approvalAddress),
      customData: {
        tx: {
          to,
          calldata: data,
          value: BigInt(value ?? 0),
        },
      },
    };
  }

  async buildTx({ request }: BuildTxParams<LiFiConfig, LiFiData>): Promise<SourceQuoteTransaction> {
    return request.customData.tx;
  }
}

function mapNativeToken(address: TokenAddress) {
  return isSameAddress(address, Addresses.NATIVE_TOKEN) ? Addresses.ZERO_ADDRESS : address;
}
