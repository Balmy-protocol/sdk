import { IGasService } from '@services/gas';
import { IMulticallService } from '@services/multicall';
import { Permit2Service } from '@services/permit2/permit2-service';
import { IQuoteService } from '@services/quotes';

export function buildPermit2Service(multicallService: IMulticallService, quoteService: IQuoteService, gasService: IGasService) {
  return new Permit2Service(multicallService, quoteService, gasService);
}
