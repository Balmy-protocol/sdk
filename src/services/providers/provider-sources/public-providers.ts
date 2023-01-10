import { Networks } from "@networks"
import { Network } from "@types"
import { providers } from "ethers"
import { IProviderSource } from "../types"

export class PublicProvidersSource implements IProviderSource {

  private readonly networks: Network[]

  constructor(networks: Network[] = Networks.getAllNetworks()) {
    this.networks = networks.filter((network) => network.publicRPCs && network.publicRPCs.length > 0)
  }

  supportedNetworks(): Network[] {
    return this.networks
  }

  getProvider(network: Network): providers.BaseProvider {
    const config = network.publicRPCs.map((url, i) => ({
      provider: new providers.StaticJsonRpcProvider(url, network.chainId),
      priority: i
    }))
    return new providers.FallbackProvider(config, 1)
  }
}
