import ms from 'ms';
import { expect } from 'chai';
import { BigNumber, constants, utils } from 'ethers';
import { given, then, when } from '@test-utils/bdd';
import { Chains } from '@chains';
import { PublicRPCsSource } from '@services/providers/provider-sources/public-providers';
import { MulticallService } from '@services/multicall/multicall-service';
import { TryMulticallResult } from '@services/multicall';
import { ProviderService } from '@services/providers/provider-service';

jest.retryTimes(3);
jest.setTimeout(ms('30s'));

const PROVIDER_SERVICE = new ProviderService(new PublicRPCsSource());

describe('Multicall Service', () => {
  describe('tryReadOnlyMulticall', () => {
    tryReadOnlyMulticallTest('ethers');
    tryReadOnlyMulticallTest('viem');
  });

  describe('readOnlyMulticall', () => {
    readOnlyMulticallTest('ethers');
    readOnlyMulticallTest('viem');
  });

  function readOnlyMulticallTest(library: 'ethers' | 'viem') {
    let response: ReadonlyArray<BigNumber>[];
    when(`trying a call with ${library}`, () => {
      given(async () => {
        const calls = [{ target: DAI, calldata: ALLOWANCE_OF_DATA, decode: ['uint256'] }];
        response = await new MulticallService(PROVIDER_SERVICE, library).readOnlyMulticall({ chainId: Chains.ETHEREUM.chainId, calls });
      });
      then('both are reported correctly', () => {
        expect(response).to.have.lengthOf(1);
        expect(response[0]).to.eql([constants.Zero]);
      });
    });
  }

  function tryReadOnlyMulticallTest(library: 'ethers' | 'viem') {
    let response: TryMulticallResult<BigNumber>[];
    when(`trying a call that fails with another that works with ${library}`, () => {
      given(async () => {
        const calls = [
          { target: DAI, calldata: TRANSFER_FROM_DATA, decode: ['uint256'] },
          { target: DAI, calldata: ALLOWANCE_OF_DATA, decode: ['uint256'] },
        ];
        response = await new MulticallService(PROVIDER_SERVICE, library).tryReadOnlyMulticall({ chainId: Chains.ETHEREUM.chainId, calls });
      });
      then('both are reported correctly', () => {
        expect(response).to.have.lengthOf(2);
        expect(response[0].success).to.be.false;
        expect(response[1]).to.eql({ success: true, result: [constants.Zero] });
      });
    });
  }
});

const ERC20_ABI = [
  'function transferFrom(address sender, address recipient, uint amount)',
  'function allowance(address owner, address owner) view returns (uint)',
];
const ERC_20_INTERFACE = new utils.Interface(ERC20_ABI);
const OWNER = '0x0000000000000000000000000000000000000001';
const DAI = '0x6b175474e89094c44da98b954eedeac495271d0f';
const TRANSFER_FROM_DATA = ERC_20_INTERFACE.encodeFunctionData('transferFrom', [OWNER, OWNER, 100000000000]);
const ALLOWANCE_OF_DATA = ERC_20_INTERFACE.encodeFunctionData('allowance', [OWNER, OWNER]);
