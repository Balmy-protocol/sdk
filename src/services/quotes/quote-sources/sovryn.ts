import { BigNumber, Contract, PopulatedTransaction, constants, ethers } from 'ethers';
import { Chains } from '@chains';
import { Chain, TokenAddress } from '@types';
import { Addresses } from '@shared/constants';
import { isSameAddress, calculatePercentage } from '@shared/utils';
import { NoCustomConfigQuoteSource, QuoteSourceMetadata, QuoteComponents, SourceQuoteRequest, SourceQuoteResponse } from './base';
import { addQuoteSlippage, failed } from './utils';

export const SOVRYN_METADATA: QuoteSourceMetadata<SovrynSupport> = {
  name: 'Sovryn',
  supports: {
    chains: [Chains.ROOTSTOCK.chainId],
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
    { providerSource, gasService }: QuoteComponents,
    { chain, sellToken, buyToken, order, config: { slippagePercentage }, accounts: { takeFrom, recipient } }: SourceQuoteRequest<SovrynSupport>
  ): Promise<SourceQuoteResponse> {
    const isSellTokenNativeToken = isSameAddress(sellToken, Addresses.NATIVE_TOKEN);
    const isBuyTokenNativeToken = isSameAddress(buyToken, Addresses.NATIVE_TOKEN);
    const routerAddress = '0x98aCE08D2b759a265ae326F010496bcD63C15afc';
    const sovrynContract = new Contract(routerAddress, SOVRYN_ABI, providerSource.getProvider({ chainId: Chains.ROOTSTOCK.chainId }));

    try {
      let path: string[] = [];
      // console.log('ether tokens', await sovrynContract.etherTokens(sellToken), await sovrynContract.etherTokens(buyToken))
      // if (isSellTokenNativeToken) {
      //   const wrapPath = await sovrynContract.conversionPath(Addresses.NATIVE_TOKEN, Chains.ROOTSTOCK.wToken);
      //   path.push(...wrapPath);
      // }
      const cpPath = await sovrynContract.conversionPath(sellToken, buyToken);
      path.push(...cpPath);
      // if (isBuyTokenNativeToken) {
      //   const unwrapPath = await sovrynContract.conversionPath(Chains.ROOTSTOCK.wToken, Addresses.NATIVE_TOKEN);
      //   path.push(...unwrapPath);
      // }
      // console.log(sellToken, buyToken, path);
      const outputAmount = await sovrynContract.rateByPath(path, order.sellAmount, {
        value: isSellTokenNativeToken ? order.sellAmount : constants.Zero,
      });
      const swapTransaction = await sovrynContract.populateTransaction.convertByPath(
        path,
        order.sellAmount,
        outputAmount,
        recipient ?? takeFrom,
        constants.AddressZero,
        0,
        // this.globalConfig.referrer?.address ?? constants.AddressZero,
        // 1_000_000,
        {
          value: isSellTokenNativeToken ? order.sellAmount : constants.Zero,
        }
      );

      const estimatedGas = await gasService.estimateGas({ chainId: Chains.ROOTSTOCK.chainId, tx: swapTransaction });

      const quote = {
        sellAmount: order.sellAmount,
        buyAmount: outputAmount,
        estimatedGas: BigNumber.from(estimatedGas),
        allowanceTarget: routerAddress,
        tx: {
          to: routerAddress,
          calldata: swapTransaction.data!,
          value: BigNumber.from(swapTransaction?.value ?? 0),
        },
      };
      return addQuoteSlippage(quote, 'sell', isSameAddress(buyToken, chain.wToken) ? 0 : slippagePercentage);
    } catch (err: any) {
      failed(chain, sellToken, buyToken, err.message);
    }
  }
}

function mapToWTokenIfNecessary(chain: Chain, address: TokenAddress) {
  return isSameAddress(address, Addresses.NATIVE_TOKEN) ? chain.wToken : address;
}

const SOVRYN_ABI = [
  'function etherTokens(address) public view returns(bool)',
  'function rateByPath(address[] _path, uint256 _amount) public view returns (uint256)',
  'function conversionPath(address _sourceToken, address _targetToken) public view returns (address[])',
  'function convertByPath(address[] _path, uint256 _amount, uint256 _minReturn, address _receiver, address _affiliateAccount, uint256 _affiliateFee) public payable returns (uint256)',
];
