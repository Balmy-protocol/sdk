import { Chains, getChainByKey } from '@chains';
import { IQuoteSource, QuoteParams, QuoteSourceMetadata, SourceQuoteResponse, SourceQuoteTransaction, BuildTxParams } from './types';
import qs from 'qs';
import { addQuoteSlippage, failed } from './utils';
import { parseUnits } from 'viem';
import { Addresses } from '@shared/constants';

// Supported Networks: https://docs.dodoex.io/en/developer/developers-portal/api/smart-trade/api
const DODO_DEX_METADATA: QuoteSourceMetadata<DodoDexSupport> = {
  name: 'DODO',
  supports: {
    chains: [
      Chains.ETHEREUM.chainId,
      Chains.BNB_CHAIN.chainId,
      Chains.ARBITRUM.chainId,
      Chains.POLYGON.chainId,
      Chains.AURORA.chainId,
      Chains.AVALANCHE.chainId,
      Chains.BASE.chainId,
      Chains.BOBA.chainId,
      Chains.BASE_GOERLI.chainId,
      Chains.HECO.chainId,
      Chains.LINEA.chainId,
      Chains.MOONRIVER.chainId,
      Chains.OKC.chainId,
      Chains.OPTIMISM.chainId,
      Chains.SCROLL.chainId,
      Chains.MANTLE.chainId,
    ],
    swapAndTransfer: false,
    buyOrders: false,
  },
  logoURI: 'ipfs://QmYpbxSqVmeHrzfjdd5JWdPitvZZhiMaeAiBGe7VT8qQTA',
};
type DodoDexConfig = { apiKey: string };
type DodoDexSupport = { buyOrders: false; swapAndTransfer: false };
type DodoDexData = { tx: SourceQuoteTransaction };
export class DodoDexQuoteSource implements IQuoteSource<DodoDexSupport, DodoDexConfig, DodoDexData> {
  getMetadata() {
    return DODO_DEX_METADATA;
  }
  async quote({
    components: { fetchService },
    request: {
      chainId,
      sellToken,
      buyToken,
      order,
      accounts: { takeFrom },
      config: { slippagePercentage, timeout },
    },
    config,
  }: QuoteParams<DodoDexSupport, DodoDexConfig>): Promise<SourceQuoteResponse<DodoDexData>> {
    const chain = getChainByKey(chainId);
    if (!chain) throw new Error(`Chain with id ${chainId} not found`);
    const queryParams = {
      chainId,
      fromAmount: order.sellAmount,
      fromTokenAddress: sellToken,
      toTokenAddress: buyToken,
      rpc: chain.publicRPCs[0],
      slippage: slippagePercentage,
      userAddr: takeFrom,
      apikey: config.apiKey,
    };

    const queryString = qs.stringify(queryParams, { skipNulls: true, arrayFormat: 'comma' });
    const quoteResponse = await fetchService.fetch(`https://api.dodoex.io/route-service/developer/swap?${queryString}`, {
      headers: { 'Content-Type': 'application/json' },
      timeout,
    });

    if (!quoteResponse.ok) {
      failed(DODO_DEX_METADATA, chainId, sellToken, buyToken, await quoteResponse.text());
    }
    const quoteResult = await quoteResponse.json();
    if (quoteResult.status < 0) {
      failed(DODO_DEX_METADATA, chainId, sellToken, buyToken, quoteResult.data);
    }
    const buyAmount = parseUnits(quoteResult.data.resAmount.toString(), quoteResult.data.targetDecimals);
    const { targetApproveAddr, data, to, value } = quoteResult.data;
    const quote = {
      sellAmount: order.sellAmount,
      buyAmount,
      estimatedGas: undefined,
      allowanceTarget: targetApproveAddr ?? Addresses.ZERO_ADDRESS,
      customData: {
        tx: {
          calldata: data,
          to,
          value: BigInt(value ?? 0),
        },
      },
    };

    return addQuoteSlippage(quote, order.type, slippagePercentage);
  }

  async buildTx({ request }: BuildTxParams<DodoDexConfig, DodoDexData>): Promise<SourceQuoteTransaction> {
    return request.customData.tx;
  }

  isConfigAndContextValidForQuoting(config: Partial<DodoDexConfig> | undefined): config is DodoDexConfig {
    return !!config?.apiKey;
  }

  isConfigAndContextValidForTxBuilding(config: Partial<DodoDexConfig> | undefined): config is DodoDexConfig {
    return true;
  }
}
