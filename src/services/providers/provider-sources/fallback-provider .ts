import { providers } from "ethers"
import { networksUnion } from "@networks"
import { Network } from "@types"
import { ArrayOneOrMore } from "@utility-types"
import { IProviderSource } from "../types"
import { FallbackProvider } from "@ethersproject/providers"

// This source will take a list of sources, sorted by priority, and use Ether's fallback
// provider on all of them (taking the priority into account)
export class FallbackSource implements IProviderSource {

  constructor(private readonly sources: ArrayOneOrMore<IProviderSource>) { }

  supportedNetworks(): Network[] {
    return networksUnion(this.sources.map(source => source.supportedNetworks()))
  }

  getProvider(network: Network): providers.BaseProvider {
    const sources = this.sources.filter(source => source.supportedNetworks().includes(network))
    if (sources.length === 0) throw new Error(`Network ${network.name} not supported`)
    const config = sources.map((source, i) => ({ provider: source.getProvider(network), priority: i }))
    return new FallbackProvider(config)
  }
}