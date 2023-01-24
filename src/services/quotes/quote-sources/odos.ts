import { BigNumber, utils } from 'ethers';
import { Address } from '@types';
import { Chains } from '@chains';
import { BaseQuoteSource, QuoteComponents, QuoteSourceMetadata, SourceQuoteRequest, SourceQuoteResponse } from './base';
import { GasPrice } from '@services/gas/types';
import { Addresses } from '@shared/constants';
import { addQuoteSlippage, failed } from './utils';
import { isSameAddress } from '@shared/utils';

type OdosConfig = { apiKey: string };
type OdosSupport = { buyOrders: false; swapAndTransfer: false };
export class OdosQuoteSource extends BaseQuoteSource<OdosSupport, true, OdosConfig> {
  getMetadata(): QuoteSourceMetadata<OdosSupport> {
    return {
      name: 'Odos',
      supports: {
        chains: [Chains.ETHEREUM, Chains.POLYGON, Chains.ARBITRUM, Chains.OPTIMISM, Chains.AVALANCHE, Chains.BNB_CHAIN],
        swapAndTransfer: false,
        buyOrders: false,
      },
      logoURI: 'ipfs://QmQAAxRF6Wu5naWvqjEfqnKD8jhCfkDayNJdULgfZfxhfG',
    };
  }

  async quote(
    { fetchService }: QuoteComponents,
    {
      chain,
      sellToken,
      buyToken,
      sellTokenData,
      buyTokenData,
      order,
      accounts: { takeFrom },
      config: { slippagePercentage, timeout },
      context,
    }: SourceQuoteRequest<OdosSupport>
  ): Promise<SourceQuoteResponse> {
    const gasPrice = await context.gasPrice;
    const sellTokenDataResult = await sellTokenData;
    const legacyGasPrice = eip1159ToLegacy(gasPrice);
    const gas_price = parseFloat(utils.formatUnits(legacyGasPrice, 9));

    const checksummedSell = checksummAndMapIfNecessary(sellToken);
    const checksummedBuy = checksummAndMapIfNecessary(buyToken);
    const body = {
      wallet: takeFrom,
      chain_id: chain.chainId,
      gas_price,
      input_tokens: [{ tokenAddress: checksummedSell, amount: utils.formatUnits(order.sellAmount, sellTokenDataResult.decimals) }],
      output_token: checksummedBuy,
      slippage: slippagePercentage,
      lp_blacklist: ['Hashflow'], // Hashflow needs the tx.origin as the wallet, so we ignore it
    };

    const response = await fetchService.fetch('https://api.odos.xyz/swap', {
      body: JSON.stringify(body),
      method: 'POST',
      headers: {
        'X-API-Key': this.customConfig.apiKey,
        'Content-Type': 'application/json',
      },
      timeout,
    });

    if (!response.ok) {
      failed(chain, sellToken, buyToken, await response.text());
    }

    const {
      outputToken,
      transaction: { to, data, value, gas },
    }: Response = await response.json();
    const buyTokenDataDataResult = await buyTokenData;

    const quote = {
      sellAmount: order.sellAmount,
      buyAmount: utils.parseUnits(parseFloat(outputToken.amount).toFixed(buyTokenDataDataResult.decimals), buyTokenDataDataResult.decimals),
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
    return gasPrice.gasPrice;
  }
  return gasPrice.maxFeePerGas;
}

type Response = {
  outputToken: {
    amount: string;
  };
  transaction: {
    gas: number;
    to: Address;
    data: string;
    value: number;
  };
};
