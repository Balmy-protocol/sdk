export const then = it;
export const given = beforeEach;
export const when = (title: string, fn: () => void) => describe('when ' + title, fn);
when.only = (title: string, fn?: () => void) => describe.only('when ' + title, fn!);
when.skip = (title: string, fn: () => void) => describe.skip('when ' + title, fn);

export const contract = describe;
