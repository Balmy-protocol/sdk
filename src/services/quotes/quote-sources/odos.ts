import { BigNumber, utils } from 'ethers';
import { Address } from '@types';
import { Chains } from '@chains';
import { QuoteParams, QuoteSourceMetadata, SourceQuoteResponse } from './types';
import { GasPrice } from '@services/gas/types';
import { Addresses } from '@shared/constants';
import { addQuoteSlippage, failed } from './utils';
import { isSameAddress } from '@shared/utils';
import { AlwaysValidConfigAndContexSource } from './base/always-valid-source';

const ODOS_METADATA: QuoteSourceMetadata<OdosSupport> = {
  name: 'Odos',
  supports: {
    chains: [
      Chains.ETHEREUM.chainId,
      Chains.POLYGON.chainId,
      Chains.ARBITRUM.chainId,
      Chains.OPTIMISM.chainId,
      Chains.AVALANCHE.chainId,
      Chains.BNB_CHAIN.chainId,
    ],
    swapAndTransfer: false,
    buyOrders: false,
  },
  logoURI: 'ipfs://Qma71evDJfVUSBU53qkf8eDDysUgojsZNSnFRWa4qWragz',
};
type OdosConfig = { sourceBlacklist?: string[] };
type OdosSupport = { buyOrders: false; swapAndTransfer: false };
export class OdosQuoteSource extends AlwaysValidConfigAndContexSource<OdosSupport, OdosConfig> {
  getMetadata() {
    return ODOS_METADATA;
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
      external,
    },
    config,
  }: QuoteParams<OdosSupport, OdosConfig>): Promise<SourceQuoteResponse> {
    const gasPrice = await external.gasPrice.request();
    const legacyGasPrice = eip1159ToLegacy(gasPrice);
    const parsedGasPrice = Number(utils.formatUnits(legacyGasPrice, 9));
    const checksummedSell = checksummAndMapIfNecessary(sellToken);
    const checksummedBuy = checksummAndMapIfNecessary(buyToken);
    const body = {
      chainId: chain.chainId,
      inputTokens: [{ tokenAddress: checksummedSell, amount: order.sellAmount.toString() }],
      outputTokens: [{ tokenAddress: checksummedBuy, proportion: 1 }],
      gasPrice: parsedGasPrice,
      userAddr: takeFrom,
      slippageLimitPercent: slippagePercentage,
      sourceBlacklist: config?.sourceBlacklist,
      simulate: false,
      pathViz: false,
    };

    const response = await fetchService.fetch('https://api.odos.xyz/sor/swap', {
      body: JSON.stringify(body),
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      timeout,
    });

    if (!response.ok) {
      failed(ODOS_METADATA, chain, sellToken, buyToken, await response.text());
    }

    const {
      outputTokens: [{ amount: outputTokenAmount }],
      transaction: { to, data, value, gas },
    }: Response = await response.json();

    const quote = {
      sellAmount: order.sellAmount,
      buyAmount: BigNumber.from(outputTokenAmount),
      calldata: data,
      estimatedGas: BigNumber.from(gas),
      allowanceTarget: to,
      tx: {
        to,
        calldata: data,
        value: BigNumber.from(value),
      },
    };

    return addQuoteSlippage(quote, 'sell', slippagePercentage);
  }
}

function checksummAndMapIfNecessary(address: Address) {
  return isSameAddress(address, Addresses.NATIVE_TOKEN) ? '0x0000000000000000000000000000000000000000' : utils.getAddress(address);
}

function eip1159ToLegacy(gasPrice: GasPrice): BigNumber {
  if ('gasPrice' in gasPrice) {
    return BigNumber.from(gasPrice.gasPrice);
  }
  return BigNumber.from(gasPrice.maxFeePerGas);
}

type Response = {
  outputTokens: {
    amount: string;
  }[];
  transaction: {
    gas: number;
    to: Address;
    data: string;
    value: number;
  };
};
