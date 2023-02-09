import { BigNumber, Contract, PopulatedTransaction, constants, ethers } from 'ethers';
import { Chains } from '@chains';
import { ChainId, Chain, TokenAddress } from '@types';
import { Addresses } from '@shared/constants';
import { isSameAddress, calculatePercentage, timeToSeconds } from '@shared/utils';
import { NoCustomConfigQuoteSource, QuoteSourceMetadata, QuoteComponents, SourceQuoteRequest, SourceQuoteResponse } from './base';
import { addQuoteSlippage, failed } from './utils';

const ROUTER_ADDRESS: Record<ChainId, string> = {
  [Chains.RSK.chainId]: '0x98aCE08D2b759a265ae326F010496bcD63C15afc',
};

export const SOVRYN_METADATA: QuoteSourceMetadata<SovrynSupport> = {
  name: 'Sovryn',
  supports: {
    chains: Object.keys(ROUTER_ADDRESS).map((chainId) => Chains.byKeyOrFail(chainId)),
    swapAndTransfer: true,
    buyOrders: false,
  },
  logoURI: 'ipfs://QmUpdb1zxtB2kUSjR1Qs1QMFPsSeZNkL21fMzGUfdjkXQA',
};
type SovrynSupport = { buyOrders: false; swapAndTransfer: true };
export class SovrynQuoteSource extends NoCustomConfigQuoteSource<SovrynSupport> {
  getMetadata() {
    return SOVRYN_METADATA;
  }

  async quote(
    _: QuoteComponents,
    { chain, sellToken, buyToken, order, config: { slippagePercentage }, accounts: { takeFrom, recipient } }: SourceQuoteRequest<SovrynSupport>
  ): Promise<SourceQuoteResponse> {
    const isSellTokenNativeToken = isSameAddress(sellToken, Addresses.NATIVE_TOKEN);
    const router = ROUTER_ADDRESS[chain.chainId];

    const sovrynContract = new Contract(router, SOVRYN_ABI, new ethers.providers.JsonRpcProvider(chain.publicRPCs![0]));

    let swapTransaction: PopulatedTransaction | undefined;
    let outputAmount: BigNumber = constants.Zero;

    try {
      const path = await sovrynContract.conversionPath(mapToWTokenIfNecessary(chain, sellToken), mapToWTokenIfNecessary(chain, buyToken));
      outputAmount = await sovrynContract.rateByPath(path, order.sellAmount);
      swapTransaction = await sovrynContract.populateTransaction.convertByPath(
        path,
        order.sellAmount,
        outputAmount,
        recipient ?? takeFrom,
        this.globalConfig.referrer?.address ?? constants.AddressZero,
        constants.Zero,
        {
          value: isSellTokenNativeToken ? order.sellAmount : constants.Zero,
        }
      );
    } catch (err: any) {
      failed(chain, sellToken, buyToken, err.message);
    }

    const estimatedGas = swapTransaction?.gasLimit?.mul(1.5) ?? BigNumber.from(1);

    const tx = {
      to: router,
      calldata: swapTransaction?.data ?? '',
      value: BigNumber.from(swapTransaction?.value ?? 0),
    };

    return {
      sellAmount: order.sellAmount,
      maxSellAmount: order.sellAmount,
      buyAmount: outputAmount,
      minBuyAmount: calculateMinBuyAmount('sell', outputAmount, slippagePercentage),
      type: 'sell',
      estimatedGas,
      allowanceTarget: router,
      tx,
    };
  }
}

function calculateMinBuyAmount(type: 'sell' | 'buy', buyAmount: BigNumber, slippagePercentage: number) {
  return type === 'sell' ? buyAmount.sub(calculatePercentage(buyAmount, slippagePercentage)) : buyAmount;
}

function mapToWTokenIfNecessary(chain: Chain, address: TokenAddress) {
  return isSameAddress(address, Addresses.NATIVE_TOKEN) ? chain.wToken : address;
}

const SOVRYN_ABI = [
  'function rateByPath(address[] _path, uint256 _amount) public view returns (uint256)',
  'function conversionPath(address _sourceToken, address _targetToken) public view returns (address[])',
  'function convertByPath(address[] _path, uint256 _amount, uint256 _minReturn, address _receiver, address _affiliateAccount, uint256 _affiliateFee) public payable returns (uint256)',
];
