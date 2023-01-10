import { ChainId, Network } from "@types"
import { networksIntersection, Networks } from "@networks";
import { IMulticallService } from "@services/multicall/types";
import { OptimismGasCalculatorBuilder } from "./optimism";
import { GenericGasCalculatorBuilder } from "./generic-gas-calculator-builder";
import { IGasPriceSource, IQuickGasCostCalculatorBuilder, IQuickGasCostCalculator } from "../types";

type ConstructorParameters = {
  gasSource: IGasPriceSource,
  multicallService: IMulticallService
}

export class GasCalculatorBuilderCombiner implements IQuickGasCostCalculatorBuilder {

  private readonly defaultCalculatorBuilder: IQuickGasCostCalculatorBuilder
  private readonly calculatorBuilderOverrides: Record<ChainId, IQuickGasCostCalculatorBuilder>

  constructor({ gasSource, multicallService }: ConstructorParameters) {
    this.defaultCalculatorBuilder = new GenericGasCalculatorBuilder(gasSource)
    this.calculatorBuilderOverrides = {
      [Networks.OPTIMISM.chainId]: new OptimismGasCalculatorBuilder(multicallService)
    }
  }
  
  supportedNetworks(): Network[] {
    return networksIntersection(
      this.defaultCalculatorBuilder.supportedNetworks(),
      Object.keys(this.calculatorBuilderOverrides).map(chainId => Networks.byKeyOrFail(chainId)),
    )
  }

  build(network: Network): Promise<IQuickGasCostCalculator> {
    const builder = this.calculatorBuilderOverrides[network.chainId] ?? this.defaultCalculatorBuilder
    return builder.build(network)
  }
}
