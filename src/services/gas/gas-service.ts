import { AmountOfToken, BigIntish, ChainId, DefaultRequirements, FieldsRequirements, TimeString, TransactionRequest } from '@types';
import { chainsIntersection } from '@chains';
import { IProviderService } from '@services/providers/types';
import { IGasService, IQuickGasCostCalculator, SupportedGasValues, IGasPriceSource, GasEstimation, GasPrice } from './types';
import { timeoutPromise } from '@shared/timeouts';
import { validateRequirements } from '@shared/requirements-and-support';
import { mapTxToViemTx } from '@shared/viem';

type ConstructorParameters<GasValues extends SupportedGasValues> = {
  providerService: IProviderService;
  gasPriceSource: IGasPriceSource<GasValues>;
};

export class GasService<GasValues extends SupportedGasValues> implements IGasService<GasValues> {
  private readonly providerService: IProviderService;
  private readonly gasPriceSource: IGasPriceSource<GasValues>;
  private readonly client: 'ethers' | 'viem' = 'viem';

  constructor({ providerService, gasPriceSource }: ConstructorParameters<GasValues>) {
    this.providerService = providerService;
    this.gasPriceSource = gasPriceSource;
  }

  supportedChains(): ChainId[] {
    return chainsIntersection(this.providerService.supportedChains(), Object.keys(this.gasPriceSource.supportedSpeeds()).map(Number));
  }

  supportedSpeeds() {
    const supportedChains = this.supportedChains();
    const entries = Object.entries(this.gasPriceSource.supportedSpeeds()).filter(([chainId]) => supportedChains.includes(Number(chainId)));
    return Object.fromEntries(entries);
  }

  estimateGas({ chainId, tx, config }: { chainId: ChainId; tx: TransactionRequest; config?: { timeout?: TimeString } }): Promise<AmountOfToken> {
    const promise = this.estimateGasInternal(chainId, tx);
    return timeoutPromise(promise, config?.timeout);
  }

  async getQuickGasCalculator<Requirements extends FieldsRequirements<GasValues> = DefaultRequirements<GasValues>>({
    chainId,
    config,
  }: {
    chainId: ChainId;
    config?: { timeout?: TimeString; fields?: Requirements };
  }): Promise<IQuickGasCostCalculator<GasValues, Requirements>> {
    validateRequirements(this.supportedSpeeds(), [chainId], config?.fields);
    const support = this.supportedSpeeds()[chainId];
    const gasPriceData = await timeoutPromise(this.gasPriceSource.getGasPrice({ chainId, config }), config?.timeout);
    return {
      supportedSpeeds: () => support,
      getGasPrice: () => gasPriceData,
      calculateGasCost: ({ gasEstimation }) => {
        const result = {} as GasEstimation<GasValues, Requirements>;
        for (const [speed, gasPriceForSpeed] of Object.entries(gasPriceData) as [string, GasPrice][]) {
          const actualGasPrice = 'maxFeePerGas' in gasPriceForSpeed ? gasPriceForSpeed.maxFeePerGas : gasPriceForSpeed.gasPrice;
          const gasCostNativeToken = (BigInt(gasEstimation) * BigInt(actualGasPrice)).toString();
          (result as any)[speed] = { gasCostNativeToken, ...gasPriceForSpeed };
        }
        return result;
      },
    };
  }

  async getGasPrice<Requirements extends FieldsRequirements<GasValues> = DefaultRequirements<GasValues>>({
    chainId,
    config,
  }: {
    chainId: ChainId;
    config?: { timeout?: TimeString; fields?: Requirements };
  }) {
    const gasCalculator = await this.getQuickGasCalculator({ chainId, config });
    return gasCalculator.getGasPrice();
  }

  async calculateGasCost<Requirements extends FieldsRequirements<GasValues> = DefaultRequirements<GasValues>>({
    chainId,
    gasEstimation,
    tx,
    config,
  }: {
    chainId: ChainId;
    gasEstimation: BigIntish;
    tx?: TransactionRequest;
    config?: { timeout?: TimeString; fields?: Requirements };
  }) {
    const gasCalculator = await this.getQuickGasCalculator({ chainId, config });
    return gasCalculator.calculateGasCost({ gasEstimation, tx });
  }

  private estimateGasInternal(chainId: ChainId, tx: TransactionRequest): Promise<AmountOfToken> {
    const viemTx = mapTxToViemTx(tx);
    const promise =
      this.client === 'viem'
        ? this.providerService.getViemPublicClient({ chainId }).estimateGas({
            ...viemTx,
            account: viemTx.from,
          })
        : this.providerService.getEthersProvider({ chainId }).estimateGas(tx);
    return promise.then((estimate) => estimate.toString());
  }
}
