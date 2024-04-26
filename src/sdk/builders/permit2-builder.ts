import { IGasService } from '@services/gas';
import { Permit2Service } from '@services/permit2/permit2-service';
import { IProviderService } from '@services/providers';
import { IQuoteService } from '@services/quotes';

export function buildPermit2Service(quoteService: IQuoteService, providerService: IProviderService, gasService: IGasService) {
  return new Permit2Service(providerService, quoteService, gasService);
}
