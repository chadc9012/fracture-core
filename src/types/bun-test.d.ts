declare module "bun:test" {
  type Fn = (...args: any[]) => any;
  export const describe: (name: string, fn: () => void) => void;
  export const test: ((name: string, fn: Fn, timeout?: number) => void) & { skip: Fn; only: Fn; each: Fn };
  export const it: typeof test;
  export const expect: any;
  export const beforeEach: (fn: Fn) => void;
  export const afterEach: (fn: Fn) => void;
  export const beforeAll: (fn: Fn) => void;
  export const afterAll: (fn: Fn) => void;
  export const mock: any;
  export const spyOn: any;
}
