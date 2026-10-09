// deno-lint-ignore no-explicit-any
type Db = any;

export class NotConnectedError extends Error {
  constructor() {
    super("NOT_CONNECTED");
  }
}

