import { TransactionRequest } from '@ethersproject/providers';
import { AmountOfToken, ChainId, TimeString } from '@types';
import { BigNumberish } from 'ethers';
import { chainsIntersection } from '@chains';
import { IProviderSource } from '@services/providers/types';
import { GasEstimation, GasPrice, GasSpeed, IGasService, IQuickGasCostCalculatorBuilder, IQuickGasCostCalculator } from './types';
import { timeoutPromise } from '@shared/timeouts';

type ConstructorParameters = {
  providerSource: IProviderSource;
  gasCostCalculatorBuilder: IQuickGasCostCalculatorBuilder;
};

export class GasService implements IGasService {
  private readonly providerSource: IProviderSource;
  private readonly gasCostCalculatorBuilder: IQuickGasCostCalculatorBuilder;

  constructor({ providerSource, gasCostCalculatorBuilder }: ConstructorParameters) {
    this.providerSource = providerSource;
    this.gasCostCalculatorBuilder = gasCostCalculatorBuilder;
  }

  supportedChains(): ChainId[] {
    return chainsIntersection(this.providerSource.supportedChains(), this.gasCostCalculatorBuilder.supportedChains());
  }

  estimateGas({ chainId, tx, config }: { chainId: ChainId; tx: TransactionRequest; config?: { timeout?: TimeString } }): Promise<AmountOfToken> {
    const promise = this.providerSource
      .getProvider({ chainId })
      .estimateGas(tx)
      .then((estimate) => estimate.toString());
    return timeoutPromise(promise, config?.timeout);
  }

  getQuickGasCalculator({ chainId, config }: { chainId: ChainId; config?: { timeout?: TimeString } }): Promise<IQuickGasCostCalculator> {
    return timeoutPromise(this.gasCostCalculatorBuilder.build({ chainId, context: config }), config?.timeout);
  }

  async getGasPrice({ chainId, config }: { chainId: ChainId; config?: { speed?: GasSpeed; timeout?: TimeString } }): Promise<GasPrice> {
    const gasCalculator = await this.getQuickGasCalculator({ chainId, config });
    return gasCalculator.getGasPrice({ speed: config?.speed });
  }

  async calculateGasCost({
    chainId,
    gasEstimation,
    tx,
    config,
  }: {
    chainId: ChainId;
    gasEstimation: BigNumberish;
    tx?: TransactionRequest;
    config?: { speed?: GasSpeed; timeout?: TimeString };
  }): Promise<GasEstimation<GasPrice>> {
    const gasCalculator = await this.getQuickGasCalculator({ chainId, config });
    return gasCalculator.calculateGasCost({ gasEstimation, tx, speed: config?.speed });
  }
}
