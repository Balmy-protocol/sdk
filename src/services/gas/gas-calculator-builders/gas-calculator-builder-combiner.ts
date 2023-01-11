import { ChainId, Network } from "@types"
import { Networks, networksUnion } from "@networks";
import { IQuickGasCostCalculatorBuilder, IQuickGasCostCalculator } from "../types";

type ConstructorParameters = {
  defaultCalculatorBuilder: IQuickGasCostCalculatorBuilder
  calculatorBuilderOverrides: Record<ChainId, IQuickGasCostCalculatorBuilder>
}

export class GasCalculatorBuilderCombiner implements IQuickGasCostCalculatorBuilder {

  private readonly defaultCalculatorBuilder: IQuickGasCostCalculatorBuilder
  private readonly calculatorBuilderOverrides: Record<ChainId, IQuickGasCostCalculatorBuilder>

  constructor({ defaultCalculatorBuilder, calculatorBuilderOverrides }: ConstructorParameters) {
    this.defaultCalculatorBuilder = defaultCalculatorBuilder
    this.calculatorBuilderOverrides = calculatorBuilderOverrides
  }

  supportedNetworks(): Network[] {
    return networksUnion([
      this.defaultCalculatorBuilder.supportedNetworks(),
      Object.keys(this.calculatorBuilderOverrides).map(chainId => Networks.byKeyOrFail(chainId)),
    ])
  }

  build(network: Network): Promise<IQuickGasCostCalculator> {
    const builder = this.calculatorBuilderOverrides[network.chainId] ?? this.defaultCalculatorBuilder
    return builder.build(network)
  }
}
