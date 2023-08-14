import { IGasService } from '@services/gas';
import { IMulticallService } from '@services/multicall';
import { Permit2Service } from '@services/permit2/permit2-service';
import { IProviderService } from '@services/providers';
import { IQuoteService } from '@services/quotes';

export function buildPermit2Service(
  multicallService: IMulticallService,
  quoteService: IQuoteService,
  providerService: IProviderService,
  gasService: IGasService
) {
  return new Permit2Service(multicallService, providerService, quoteService, gasService);
}
