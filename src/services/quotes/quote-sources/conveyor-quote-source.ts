import { isHex } from 'viem';
import { Chains } from '@chains';
import { ChainId } from '@types';
import { QuoteParams, QuoteSourceMetadata, SourceQuoteResponse, SourceQuoteTransaction, BuildTxParams } from './types';
import { AlwaysValidConfigAndContextSource } from './base/always-valid-source';
import { calculateAllowanceTarget, failed } from './utils';

const DEFAULT_REFERRERS: Record<ChainId, number> = {
  [Chains.ETHEREUM.chainId]: 6,
  [Chains.OPTIMISM.chainId]: 4,
  [Chains.POLYGON.chainId]: 4,
  [Chains.BNB_CHAIN.chainId]: 4,
  [Chains.ARBITRUM.chainId]: 3,
  [Chains.BASE.chainId]: 4,
};

const CONVEYOR_METADATA: QuoteSourceMetadata<ConveyorSupport> = {
  name: 'Conveyor',
  supports: {
    chains: [
      Chains.ETHEREUM.chainId,
      Chains.BNB_CHAIN.chainId,
      Chains.BASE.chainId,
      Chains.OPTIMISM.chainId,
      Chains.ARBITRUM.chainId,
      Chains.POLYGON.chainId,
    ],
    swapAndTransfer: false,
    buyOrders: false,
  },
  logoURI: 'ipfs://QmcuftRVxMooC2pvyBAcePW7of9JzzGArMyWFGrY6EpwCT',
};
type ConveyorConfig = { referrerCodes?: Record<ChainId, number> | 'disable' };
type ConveyorSupport = { buyOrders: false; swapAndTransfer: false };
type ConveyorData = { tx: SourceQuoteTransaction };
export class ConveyorQuoteSource extends AlwaysValidConfigAndContextSource<ConveyorSupport, ConveyorConfig, ConveyorData> {
  getMetadata() {
    return CONVEYOR_METADATA;
  }

  async quote({
    components: { fetchService },
    request: {
      chainId,
      sellToken,
      buyToken,
      order,
      config: { slippagePercentage, timeout },
      accounts: { takeFrom },
    },
    config,
  }: QuoteParams<ConveyorSupport, ConveyorConfig>): Promise<SourceQuoteResponse<ConveyorData>> {
    let referrer = '0';
    if (config.referrerCodes !== 'disable') {
      referrer = `${config.referrerCodes?.[chainId] ?? DEFAULT_REFERRERS[chainId] ?? 0}`;
    }

    const body = {
      tokenIn: sellToken,
      tokenOut: buyToken,
      amountIn: order.sellAmount.toString(),
      slippage: slippagePercentage * 100,
      // Note: Conveyor doesn't support swap & transfer, so the recipient must be the same as the taker address
      recipient: takeFrom,
      chainId,
      referrer,
      partner: config.referrer?.name,
      forceCalldata: true,
    };

    const response = await fetchService.fetch('https://api.conveyor.finance', {
      timeout,
      method: 'POST',
      body: JSON.stringify(body),
    });
    if (!response.ok) {
      failed(CONVEYOR_METADATA, chainId, sellToken, buyToken, await response.text());
    }
    const { body: result } = await response.json();
    if ('errorStatus' in result && !config.disableValidation) {
      // We don't have a way to disable Conveyor's validation, but we can work around it. So we will only fail
      // when the validation fails, and the config didn't mark it as disabled
      failed(CONVEYOR_METADATA, chainId, sellToken, buyToken, JSON.stringify(result.errorStatus));
    }
    if (!('tx' in result) && 'message' in result) {
      failed(CONVEYOR_METADATA, chainId, sellToken, buyToken, result.message);
    }

    const {
      tx: { to, data, simulation, value },
      info: { amountOut, amountOutMin, conveyorGas },
    } = result;
    return {
      sellAmount: order.sellAmount,
      maxSellAmount: order.sellAmount,
      buyAmount: BigInt(amountOut),
      minBuyAmount: BigInt(amountOutMin),
      estimatedGas: BigInt(conveyorGas),
      type: 'sell',
      allowanceTarget: calculateAllowanceTarget(sellToken, to),
      customData: {
        tx: {
          calldata: isHex(data) ? data : simulation.data,
          to,
          value: BigInt(value ?? 0),
        },
      },
    };
  }

  async buildTx({ request }: BuildTxParams<ConveyorConfig, ConveyorData>): Promise<SourceQuoteTransaction> {
    return request.customData.tx;
  }
}
