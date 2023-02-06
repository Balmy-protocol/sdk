import { ChainId } from '@types';
import { chainsUnion } from '@chains';
import { IQuickGasCostCalculatorBuilder, IQuickGasCostCalculator } from '../types';

type ConstructorParameters = {
  defaultCalculatorBuilder: IQuickGasCostCalculatorBuilder;
  calculatorBuilderOverrides: Record<ChainId, IQuickGasCostCalculatorBuilder>;
};

export class GasCalculatorBuilderCombiner implements IQuickGasCostCalculatorBuilder {
  private readonly defaultCalculatorBuilder: IQuickGasCostCalculatorBuilder;
  private readonly calculatorBuilderOverrides: Record<ChainId, IQuickGasCostCalculatorBuilder>;

  constructor({ defaultCalculatorBuilder, calculatorBuilderOverrides }: ConstructorParameters) {
    this.defaultCalculatorBuilder = defaultCalculatorBuilder;
    this.calculatorBuilderOverrides = calculatorBuilderOverrides;
  }

  supportedChains(): ChainId[] {
    return chainsUnion([
      this.defaultCalculatorBuilder.supportedChains(),
      Object.keys(this.calculatorBuilderOverrides).map((chainId) => parseInt(chainId)),
    ]);
  }

  build({ chainId }: { chainId: ChainId }): Promise<IQuickGasCostCalculator> {
    const builder = this.calculatorBuilderOverrides[chainId] ?? this.defaultCalculatorBuilder;
    return builder.build({ chainId });
  }
}
