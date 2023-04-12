import { BigNumber, constants, utils } from 'ethers';
import { serialize } from '@ethersproject/transactions';
import { Chains } from '@chains';
import { IMulticallService } from '@services/multicall/types';
import {
  GasEstimation,
  GasPriceResult,
  GasValueForVersion,
  IQuickGasCostCalculator,
  IQuickGasCostCalculatorBuilder,
  LegacyGasPrice,
} from '@services/gas/types';
import { ChainId, FieldsRequirements, SupportRecord, TimeString, Transaction } from '@types';

const OPTIMISM_GAS_ORACLE_ADDRESS = '0x420000000000000000000000000000000000000F';

type GasValues = GasValueForVersion<'standard', LegacyGasPrice>;
export class OptimismGasCalculatorBuilder implements IQuickGasCostCalculatorBuilder<GasValues> {
  constructor(private readonly multicallService: IMulticallService) {}

  supportedSpeeds() {
    const support: SupportRecord<GasValues> = { standard: 'present' };
    return { [Chains.OPTIMISM.chainId]: support };
  }

  async build<Requirements extends FieldsRequirements<GasValues>>(_: {
    chainId: ChainId;
    config?: { fields?: Requirements; timeout?: TimeString };
  }): Promise<IQuickGasCostCalculator<GasValues, Requirements>> {
    const { l2GasPrice, ...l1GasValues } = await getGasValues(this.multicallService);
    return {
      supportedSpeeds: () => ({ standard: 'present' }),
      getGasPrice: () => ({ standard: { gasPrice: l2GasPrice.toString() } } as GasPriceResult<GasValues, Requirements>),
      calculateGasCost: ({ gasEstimation, tx }) => {
        const l1GasCost = (tx && getL1Fee(tx, l1GasValues)) ?? constants.Zero;
        const l2GasCost = l2GasPrice.mul(gasEstimation);
        const gasCostNativeToken = l1GasCost.add(l2GasCost).toString();
        return { standard: { gasCostNativeToken, gasPrice: l2GasPrice.toString() } } as GasEstimation<GasValues, Requirements>;
      },
    };
  }
}

async function getGasValues(multicallService: IMulticallService) {
  const [[overhead], [l1BaseFee], [decimals], [scalar], [l2GasPrice]]: ReadonlyArray<BigNumber>[] = await multicallService.readOnlyMulticall({
    chainId: Chains.OPTIMISM.chainId,
    calls: [
      { target: OPTIMISM_GAS_ORACLE_ADDRESS, calldata: OVERHEAD_CALLDATA, decode: ['uint256'] },
      { target: OPTIMISM_GAS_ORACLE_ADDRESS, calldata: L1_BASE_FEE_CALLDATA, decode: ['uint256'] },
      { target: OPTIMISM_GAS_ORACLE_ADDRESS, calldata: DECIMALS_CALLDATA, decode: ['uint256'] },
      { target: OPTIMISM_GAS_ORACLE_ADDRESS, calldata: SCALAR_CALLDATA, decode: ['uint256'] },
      { target: OPTIMISM_GAS_ORACLE_ADDRESS, calldata: GAS_PRICE_CALLDATA, decode: ['uint256'] },
    ],
  });
  return { overhead, l1BaseFee, decimals, scalar, l2GasPrice };
}

function getL1Fee(
  tx: Transaction,
  { overhead, l1BaseFee, scalar, decimals }: { overhead: BigNumber; l1BaseFee: BigNumber; scalar: BigNumber; decimals: BigNumber }
) {
  const l1GasUsed = getL1GasUsed(tx, overhead);
  const l1Fee = l1GasUsed.mul(l1BaseFee);
  const unscaled = l1Fee.mul(scalar);
  const divisor = BigNumber.from(10).pow(decimals);
  const scaled = unscaled.div(divisor);
  return scaled;
}

function getL1GasUsed(tx: Transaction, overhead: BigNumber) {
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
