import { DCAService } from '@services/dca/dca-service';
import { IMulticallService } from '@services/multicall';
import { IPermit2Service } from '@services/permit2';
import { IQuoteService } from '@services/quotes';

export function buildDCAService(multicallService: IMulticallService, permit2Service: IPermit2Service, quoteService: IQuoteService) {
  return new DCAService(multicallService, permit2Service, quoteService);
}
