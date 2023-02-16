import ms from 'ms';
import chai, { expect } from 'chai';
import { RPCSimulationSource } from '@services/simulations/simulation-sources/rpc-simulation-source';
import { Chains } from '@chains';
import { BigNumber, utils } from 'ethers';
import chaiAsPromised from 'chai-as-promised';
import dotenv from 'dotenv';
import {
  ERC20ApprovalStateChange,
  ERC20TransferStateChange,
  FailedSimulation,
  ISimulationSource,
  NativeTransferStateChange,
  SuccessfulSimulation,
} from '@services/simulations/types';
import { then, when } from '@test-utils/bdd';
import { PublicRPCsSource } from '@services/providers/provider-sources/public-providers';
dotenv.config();
chai.use(chaiAsPromised);

// const FETCH_SERVICE = new FetchService(crossFetch);
// const ALCHEMY_SIMULATION_SOURCE = new AlchemySimulationSource(FETCH_SERVICE, process.env.ALCHEMY_API_KEY!);
// const BLOWFISH_SIMULATION_SOURCE = new BlowfishSimulationSource(FETCH_SERVICE, process.env.BLOWFISH_API_KEY!);
const RPC_SIMULATION_SOURCE = new RPCSimulationSource(new PublicRPCsSource());

jest.retryTimes(2);
jest.setTimeout(ms('1m'));

const OWNER = '0x0000000000000000000000000000000000000001';
const TAKER = '0x0000000000000000000000000000000000000002';
const DAI = '0x6b175474e89094c44da98b954eedeac495271d0f';
const ONE_ETHER = utils.parseEther('1').toString();

describe('Simulation Sources', () => {
  // simulationSourceTest({ title: 'Alchemy Source', source: ALCHEMY_SIMULATION_SOURCE }); Skipped due to rate limiting issues
  simulationSourceTest({ title: 'RPC Source', source: RPC_SIMULATION_SOURCE });
  // simulationSourceTest({ title: 'Blowfish Source', source: BLOWFISH_SIMULATION_SOURCE });

  function simulationSourceTest({ title, source }: { title: string; source: ISimulationSource }) {
    describe(title, () => {
      const sourceSupport = source.supportedQueries()[Chains.ETHEREUM.chainId];

      test('tx simulation is supported', () => {
        expect(sourceSupport.transaction).to.not.equal('none');
      });

      when('passing an invalid tx', () => {
        then('result says so', async () => {
          const simulationResult = await source.simulateTransaction({
            chainId: Chains.ETHEREUM.chainId,
            tx: { from: 'not-an-address', to: 'not-an-address', data: TRANSFER_FROM_DATA },
          });
          expect(simulationResult.successful).to.be.false;
          const failed = simulationResult as FailedSimulation;
          expect(failed.kind).to.equal('INVALID_TRANSACTION');
          expect(failed.message).to.not.be.undefined;
        });
      });

      when('passing a tx that will revert', () => {
        then('result says so', async () => {
          const simulationResult = await source.simulateTransaction({
            chainId: Chains.ETHEREUM.chainId,
            tx: { from: TAKER, to: DAI, data: TRANSFER_FROM_DATA },
          });
          expect(simulationResult.successful).to.be.false;
          const failed = simulationResult as FailedSimulation;
          expect(failed.kind).to.equal('SIMULATION_FAILED');
          expect(failed.message).to.not.be.undefined;
        });
      });

      when('passing a transaction with unsupported state changes', () => {
        then('result is ok', async () => {
          const simulationResult = await source.simulateTransaction({
            chainId: Chains.ETHEREUM.chainId,
            tx: { from: TAKER, to: MULTICALL_ADDRESS, data: AGGREGATE_DATA },
          });
          expect(simulationResult.successful).to.be.true;
          const success = simulationResult as SuccessfulSimulation;
          expectGasToBeSet(success);
          expect(success.stageChanges).to.be.empty;
        });
      });

      when('passing an approval tx', () => {
        then('result is ok', async () => {
          const simulationResult = await source.simulateTransaction({
            chainId: Chains.ETHEREUM.chainId,
            tx: { from: OWNER, to: DAI, data: APPROVE_DATA },
          });
          expect(simulationResult.successful).to.be.true;
          const success = simulationResult as SuccessfulSimulation;
          expectGasToBeSet(success);
          if (sourceSupport.transaction === 'gas-only') {
            expect(success.stageChanges).to.be.empty;
          } else {
            expect(success.stageChanges).to.have.lengthOf(1);
            expect(success.stageChanges[0].type).to.equal('ERC20_APPROVAL');
            const stateChange = success.stageChanges[0] as ERC20ApprovalStateChange;
            expect(stateChange.owner).to.equal(OWNER);
            expect(stateChange.spender).to.equal(TAKER);
            expect(stateChange.amount.amount).to.equal(ONE_ETHER);
            expect(stateChange.amount.amountInUnits).to.equal('1');
            expect(stateChange.asset.address).to.equal(DAI);
            expect(stateChange.asset.symbol).to.equal('DAI');
            expect(stateChange.asset.name).to.equal('Dai');
            expect(stateChange.asset.decimals).to.equal(18);
          }
        });
      });

      when('passing a native transfer tx', () => {
        then('result is ok', async () => {
          const simulationResult = await source.simulateTransaction({
            chainId: Chains.ETHEREUM.chainId,
            tx: { from: OWNER, to: TAKER, value: ONE_ETHER },
          });
          expect(simulationResult.successful).to.be.true;
          const success = simulationResult as SuccessfulSimulation;
          expectGasToBeSet(success);
          if (sourceSupport.transaction === 'gas-only') {
            expect(success.stageChanges).to.be.empty;
          } else {
            expect(success.stageChanges).to.have.lengthOf(1);
            expect(success.stageChanges[0].type).to.equal('NATIVE_ASSET_TRANSFER');
            const stateChange = success.stageChanges[0] as NativeTransferStateChange;
            expect(stateChange.from).to.equal(OWNER);
            expect(stateChange.to).to.equal(TAKER);
            expect(stateChange.amount.amount).to.equal(ONE_ETHER);
            expect(stateChange.amount.amountInUnits).to.equal('1');
            expect(stateChange.asset.symbol).to.equal('ETH');
            expect(stateChange.asset.name).to.equal('Ethereum');
            expect(stateChange.asset.decimals).to.equal(18);
          }
        });
      });

      when('passing an erc20 transfer tx', () => {
        then('result is ok', async () => {
          const simulationResult = await source.simulateTransaction({
            chainId: Chains.ETHEREUM.chainId,
            tx: { from: OWNER, to: DAI, data: TRANSFER_DATA },
          });
          expect(simulationResult.successful).to.be.true;
          const success = simulationResult as SuccessfulSimulation;
          expectGasToBeSet(success);
          if (sourceSupport.transaction === 'gas-only') {
            expect(success.stageChanges).to.be.empty;
          } else {
            expect(success.stageChanges).to.have.lengthOf(1);
            expect(success.stageChanges[0].type).to.equal('ERC20_TRANSFER');
            const stateChange = success.stageChanges[0] as ERC20TransferStateChange;
            expect(stateChange.from).to.equal(OWNER);
            expect(stateChange.to).to.equal(TAKER);
            expect(stateChange.amount.amount).to.equal(ONE_ETHER);
            expect(stateChange.amount.amountInUnits).to.equal('1');
            expect(stateChange.asset.address).to.equal(DAI);
            expect(stateChange.asset.symbol).to.equal('DAI');
            expect(stateChange.asset.name).to.equal('Dai');
            expect(stateChange.asset.decimals).to.equal(18);
          }
        });
      });

      if (sourceSupport.bundle === 'none') {
        when('bundles are not supported', () => {
          then('trying to execute a bundle simulation will fail', async () => {
            await expect(
              source.simulateTransactionBundle({
                chainId: Chains.ETHEREUM.chainId,
                bundle: [{ from: OWNER, to: DAI, data: TRANSFER_DATA }],
              })
            ).to.eventually.be.rejectedWith('Operation not supported');
          });
        });
      }
    });
  }
});

function expectGasToBeSet(simulationResult: SuccessfulSimulation) {
  expect(BigNumber.from(simulationResult.estimatedGas).gt(0)).to.be.true;
}

const ERC20_ABI = [
  'function transfer(address to, uint amount)',
  'function transferFrom(address sender, address recipient, uint amount)',
  'function approve(address to, uint amount)',
  'function balanceOf(address owner) view returns (uint)',
];
const ERC_20_INTERFACE = new utils.Interface(ERC20_ABI);
const APPROVE_DATA = ERC_20_INTERFACE.encodeFunctionData('approve', [TAKER, ONE_ETHER]);
const TRANSFER_FROM_DATA = ERC_20_INTERFACE.encodeFunctionData('transferFrom', [OWNER, TAKER, ONE_ETHER]);
const TRANSFER_DATA = ERC_20_INTERFACE.encodeFunctionData('transfer', [TAKER, ONE_ETHER]);

const MULTICALL_ADDRESS = '0xcA11bde05977b3631167028862bE2a173976CA11';
const MULTICALL_ABI = [
  'function aggregate(tuple(address target, bytes callData)[] calls) payable returns (uint256 blockNumber, bytes[] returnData)',
];
const MULTICALL_INTERFACE = new utils.Interface(MULTICALL_ABI);
const AGGREGATE_DATA = MULTICALL_INTERFACE.encodeFunctionData('aggregate', [[]]);
