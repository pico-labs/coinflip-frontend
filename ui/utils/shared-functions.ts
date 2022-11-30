function assertIsString(value: unknown): asserts value is string {
  if (typeof value !== 'string') {
    throw `expected value: ${value} to be string but got: ${typeof value}`;
  }
}

export {
  assertIsString
}