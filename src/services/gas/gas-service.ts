import { AmountOfToken, AmountOfTokenInput, ChainId, DefaultRequirements, FieldsRequirements, TimeString, Transaction } from '@types';
import { chainsIntersection } from '@chains';
import { IProviderService } from '@services/providers/types';
import { IGasService, IQuickGasCostCalculatorBuilder, IQuickGasCostCalculator, SupportedGasValues } from './types';
import { timeoutPromise } from '@shared/timeouts';
import { validateRequirements } from '@shared/requirements-and-support';
import { mapTxToViemTx } from '@shared/viem';

type ConstructorParameters<GasValues extends SupportedGasValues> = {
  providerService: IProviderService;
  gasCostCalculatorBuilder: IQuickGasCostCalculatorBuilder<GasValues>;
};

export class GasService<GasValues extends SupportedGasValues> implements IGasService<GasValues> {
  private readonly providerService: IProviderService;
  private readonly gasCostCalculatorBuilder: IQuickGasCostCalculatorBuilder<GasValues>;

  constructor({ providerService, gasCostCalculatorBuilder }: ConstructorParameters<GasValues>) {
    this.providerService = providerService;
    this.gasCostCalculatorBuilder = gasCostCalculatorBuilder;
  }

  supportedChains(): ChainId[] {
    return chainsIntersection(this.providerService.supportedChains(), Object.keys(this.gasCostCalculatorBuilder.supportedSpeeds()).map(Number));
  }

  supportedSpeeds() {
    const supportedChains = this.supportedChains();
    const entries = Object.entries(this.gasCostCalculatorBuilder.supportedSpeeds()).filter(([chainId]) =>
      supportedChains.includes(Number(chainId))
    );
    return Object.fromEntries(entries);
  }

  estimateGas({ chainId, tx, config }: { chainId: ChainId; tx: Transaction; config?: { timeout?: TimeString } }): Promise<AmountOfToken> {
    const viemTx = mapTxToViemTx(tx);
    const promise = this.providerService
      .getViemClient({ chainId })
      .estimateGas({
        ...viemTx,
        account: viemTx.from,
      })
      .then((estimate) => estimate.toString());
    return timeoutPromise(promise, config?.timeout);
  }

  getQuickGasCalculator<Requirements extends FieldsRequirements<GasValues> = DefaultRequirements<GasValues>>({
    chainId,
    config,
  }: {
    chainId: ChainId;
    config?: { timeout?: TimeString; fields?: Requirements };
  }): Promise<IQuickGasCostCalculator<GasValues, Requirements>> {
    validateRequirements(this.supportedSpeeds(), [chainId], config?.fields);
    return timeoutPromise(this.gasCostCalculatorBuilder.build({ chainId, config }), config?.timeout);
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
    gasEstimation: AmountOfTokenInput;
    tx?: Transaction;
    config?: { timeout?: TimeString; fields?: Requirements };
  }) {
    const gasCalculator = await this.getQuickGasCalculator({ chainId, config });
    return gasCalculator.calculateGasCost({ gasEstimation, tx });
  }
}
