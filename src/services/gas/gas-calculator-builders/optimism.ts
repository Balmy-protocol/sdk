import { BigNumber, constants, utils } from 'ethers';
import { TransactionRequest } from '@ethersproject/abstract-provider';
import { serialize } from '@ethersproject/transactions';
import { Chains } from '@chains';
import { IMulticallService } from '@services/multicall/types';
import { IQuickGasCostCalculator, IQuickGasCostCalculatorBuilder } from '@services/gas/types';
import { ChainId } from '@types';

const OPTIMISM_GAS_ORACLE_ADDRESS = '0x420000000000000000000000000000000000000F';

export class OptimismGasCalculatorBuilder implements IQuickGasCostCalculatorBuilder {
  constructor(private readonly multicallService: IMulticallService) {}

  supportedChains(): ChainId[] {
    return [Chains.OPTIMISM.chainId];
  }

  async build(_: { chainId: ChainId }): Promise<IQuickGasCostCalculator> {
    const { l2GasPrice, ...l1GasValues } = await getGasValues(this.multicallService);
    return {
      getGasPrice: () => ({ gasPrice: l2GasPrice.toString() }),
      calculateGasCost: ({ gasEstimation, tx }) => {
        const l1GasCost = (tx && getL1Fee(tx, l1GasValues)) ?? constants.Zero;
        const l2GasCost = l2GasPrice.mul(gasEstimation);
        const gasCostNativeToken = l1GasCost.add(l2GasCost).toString();
        return { gasCostNativeToken, gasPrice: l2GasPrice.toString() };
      },
    };
  }
}

async function getGasValues(multicallService: IMulticallService) {
  const [overhead, l1BaseFee, decimals, scalar, l2GasPrice]: BigNumber[] = await multicallService.readOnlyMulticallToSingleTarget({
    target: OPTIMISM_GAS_ORACLE_ADDRESS,
    chainId: Chains.OPTIMISM.chainId,
    calls: [
      { calldata: OVERHEAD_CALLDATA, decode: 'uint256' },
      { calldata: L1_BASE_FEE_CALLDATA, decode: 'uint256' },
      { calldata: DECIMALS_CALLDATA, decode: 'uint256' },
      { calldata: SCALAR_CALLDATA, decode: 'uint256' },
      { calldata: GAS_PRICE_CALLDATA, decode: 'uint256' },
    ],
  });
  return { overhead, l1BaseFee, decimals, scalar, l2GasPrice };
}

function getL1Fee(
  tx: TransactionRequest,
  { overhead, l1BaseFee, scalar, decimals }: { overhead: BigNumber; l1BaseFee: BigNumber; scalar: BigNumber; decimals: BigNumber }
) {
  const l1GasUsed = getL1GasUsed(tx, overhead);
  const l1Fee = l1GasUsed.mul(l1BaseFee);
  const unscaled = l1Fee.mul(scalar);
  const divisor = BigNumber.from(10).pow(decimals);
  const scaled = unscaled.div(divisor);
  return scaled;
}

function getL1GasUsed(tx: TransactionRequest, overhead: BigNumber) {
  const nonce = BigNumber.from(tx.nonce ?? 0xffffffff).toNumber();
  const value = BigNumber.from(tx.value ?? 0).toHexString();
  const gasLimit = BigNumber.from(tx.gasLimit ?? 0).toHexString();
  const { from, ...unsignedTx } = tx;
  const data = serialize({ ...unsignedTx, gasLimit, nonce, value });
  let total = constants.Zero;
  for (const byte of data) {
    if (byte === '0') {
      total = total.add(4);
    } else {
      total = total.add(16);
    }
  }
  const unsigned = total.add(overhead);
  return unsigned.add(68 * 16);
}

const ORACLE_ABI = [
  'function l1BaseFee() view returns (uint256)',
  'function overhead() view returns (uint256)',
  'function scalar() view returns (uint256)',
  'function decimals() view returns (uint256)',
  'function gasPrice() view returns (uint256)',
];

const ERC_20_INTERFACE = new utils.Interface(ORACLE_ABI);
const OVERHEAD_CALLDATA = ERC_20_INTERFACE.encodeFunctionData('overhead');
const L1_BASE_FEE_CALLDATA = ERC_20_INTERFACE.encodeFunctionData('l1BaseFee');
const DECIMALS_CALLDATA = ERC_20_INTERFACE.encodeFunctionData('decimals');
const SCALAR_CALLDATA = ERC_20_INTERFACE.encodeFunctionData('scalar');
const GAS_PRICE_CALLDATA = ERC_20_INTERFACE.encodeFunctionData('gasPrice');
