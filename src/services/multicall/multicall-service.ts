import { Contract } from "ethers"
import { AbiCoder } from "ethers/lib/utils";
import { Address, Network } from "@types";
import { IProviderSource } from "@services/providers/types";
import { IMulticallService } from "./types";

const ADDRESS = '0xcA11bde05977b3631167028862bE2a173976CA11'
export class MulticallService implements IMulticallService {

  private readonly ABI_CODER = new AbiCoder()
  constructor(private readonly providerService: IProviderSource) { }

  supportedNetworks(): Network[] {
    // TODO: Check networks supported by the multicall service https://github.com/mds1/multicall and calculate intersection
    return this.providerService.supportedNetworks()
  }

  readOnlyMulticallToSingleTarget({ network, target, calls }: { network: Network, target: Address, calls: { calldata: string, decode: string }[] }) {
    return this.readOnlyMulticall({ network, calls: calls.map(({ calldata, decode }) => ({ target, calldata, decode })) })
  }

  async readOnlyMulticall({ network, calls }: { network: Network, calls: { target: Address, calldata: string, decode: string }[] }) {
    const multicall = this.getMulticall(network)
    const [blockNumber, results]: [number, [string]] = await multicall.callStatic.aggregate(calls.map(({ target, calldata }) => [target, calldata]))
    return results.map((result, i) => this.ABI_CODER.decode([calls[i].decode], result)[0])
  }

  private getMulticall(network: Network) {
    return new Contract(ADDRESS, MULTICALL_ABI, this.providerService.getProvider(network))
  }
}

const MULTICALL_ABI = [
  // https://github.com/mds1/multicall
  'function aggregate(tuple(address target, bytes callData)[] calls) payable returns (uint256 blockNumber, bytes[] returnData)',
  'function aggregate3(tuple(address target, bool allowFailure, bytes callData)[] calls) payable returns (tuple(bool success, bytes returnData)[] returnData)',
  'function aggregate3Value(tuple(address target, bool allowFailure, uint256 value, bytes callData)[] calls) payable returns (tuple(bool success, bytes returnData)[] returnData)',
  'function blockAndAggregate(tuple(address target, bytes callData)[] calls) payable returns (uint256 blockNumber, bytes32 blockHash, tuple(bool success, bytes returnData)[] returnData)',
  'function getBasefee() view returns (uint256 basefee)',
  'function getBlockHash(uint256 blockNumber) view returns (bytes32 blockHash)',
  'function getBlockNumber() view returns (uint256 blockNumber)',
  'function getChainId() view returns (uint256 chainid)',
  'function getCurrentBlockCoinbase() view returns (address coinbase)',
  'function getCurrentBlockDifficulty() view returns (uint256 difficulty)',
  'function getCurrentBlockGasLimit() view returns (uint256 gaslimit)',
  'function getCurrentBlockTimestamp() view returns (uint256 timestamp)',
  'function getEthBalance(address addr) view returns (uint256 balance)',
  'function getLastBlockHash() view returns (bytes32 blockHash)',
  'function tryAggregate(bool requireSuccess, tuple(address target, bytes callData)[] calls) payable returns (tuple(bool success, bytes returnData)[] returnData)',
  'function tryBlockAndAggregate(bool requireSuccess, tuple(address target, bytes callData)[] calls) payable returns (uint256 blockNumber, bytes32 blockHash, tuple(bool success, bytes returnData)[] returnData)',
];