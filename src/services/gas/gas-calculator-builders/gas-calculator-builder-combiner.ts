import { ChainId, FieldsRequirements, TimeString } from '@types';
import { IQuickGasCostCalculatorBuilder, IQuickGasCostCalculator } from '../types';

type ConstructorParameters<
  Default extends IQuickGasCostCalculatorBuilder<object>,
  Overrides extends Record<ChainId, IQuickGasCostCalculatorBuilder<object>>
> = {
  defaultCalculatorBuilder: Default;
  calculatorBuilderOverrides: Overrides;
};

export class GasCalculatorBuilderCombiner<
  Default extends IQuickGasCostCalculatorBuilder<object>,
  Overrides extends Record<ChainId, IQuickGasCostCalculatorBuilder<object>>
> implements IQuickGasCostCalculatorBuilder<CombinationGasValues<Default, Overrides>>
{
  private readonly defaultCalculatorBuilder: Default;
  private readonly calculatorBuilderOverrides: Overrides;

  constructor({ defaultCalculatorBuilder, calculatorBuilderOverrides }: ConstructorParameters<Default, Overrides>) {
    this.defaultCalculatorBuilder = defaultCalculatorBuilder;
    this.calculatorBuilderOverrides = calculatorBuilderOverrides;
  }

  supportedSpeeds() {
    const result = this.defaultCalculatorBuilder.supportedSpeeds();
    for (const [chainIdString, builder] of Object.entries(this.calculatorBuilderOverrides)) {
      const chainId = Number(chainIdString);
      result[chainId] = builder.supportedSpeeds()[chainId];
    }
    return result as CombinationGasValues<Default, Overrides>;
  }

  async build<Requirements extends FieldsRequirements<CombinationGasValues<Default, Overrides>>>({
    chainId,
    config,
    context,
  }: {
    chainId: ChainId;
    config?: { fields?: Requirements };
    context?: { timeout?: TimeString };
  }) {
    const builder = this.calculatorBuilderOverrides[chainId] ?? this.defaultCalculatorBuilder;
    return builder.build({ chainId, config, context }) as Promise<
      IQuickGasCostCalculator<CombinationGasValues<Default, Overrides>, Requirements>
    >;
  }
}

type ExtractGasValues<Builder extends any> = Builder extends IQuickGasCostCalculatorBuilder<infer GasValues> ? GasValues : never;
type OverridesGasValuesUnion<BuilderRecord extends Record<ChainId, IQuickGasCostCalculatorBuilder<object>>> = {
  [K in keyof BuilderRecord]: ExtractGasValues<BuilderRecord[K]>;
}[keyof BuilderRecord];

type CombinationGasValues<
  Default extends IQuickGasCostCalculatorBuilder<object>,
  Overrides extends Record<ChainId, IQuickGasCostCalculatorBuilder<object>>
> = ExtractGasValues<Default> | OverridesGasValuesUnion<Overrides>;
