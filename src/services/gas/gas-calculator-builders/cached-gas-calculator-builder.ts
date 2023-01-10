import { ChainId, Network } from "@types"
import { IQuickGasCostCalculatorBuilder, IQuickGasCostCalculator } from "../types";
import { Cache, ExpirationConfigOptions } from "@shared/generic-cache";

type ConstructorParameters = {
  wrapped: IQuickGasCostCalculatorBuilder,
  expiration: {
    default: ExpirationConfigOptions,
    overrides?: Record<ChainId, ExpirationConfigOptions>
  }
}

export class CachedGasCalculatorBuilder implements IQuickGasCostCalculatorBuilder {

  private readonly cache: Cache<Network, ChainId, IQuickGasCostCalculatorBuilder>
  private readonly wrapped: IQuickGasCostCalculatorBuilder
  private readonly expirationOverrides: Record<ChainId, ExpirationConfigOptions>

  constructor({ wrapped, expiration }: ConstructorParameters) {
    this.wrapped = wrapped
    this.cache = new Cache<Network, ChainId, IQuickGasCostCalculatorBuilder>({
      calculate: (network, [chainId]) => this.wrapped.build(network), // We know that we will only ask for one network at a time
      toStorableKey: (network, chainId) => `${chainId}`,
      expirationConfig: expiration.default
    })
    this.expirationOverrides = expiration.overrides ?? {}
  }

  supportedNetworks(): Network[] {
    return this.wrapped.supportedNetworks()
  }

  async build(network: Network): Promise<IQuickGasCostCalculator> {
    const expirationConfig = this.expirationOverrides[network.chainId]
    const calculator = await this.cache.getOrCalculateSingle({
      key: network.chainId,
      context: network,
      expirationConfig
    })
    return calculator!.build(network)
  }
}
