import {FetchError, FetchResult, FetchSuccess} from '../pages/zkappWorker';

function assertIsString(value: unknown): asserts value is string {
  if (typeof value !== 'string') {
    throw `expected value: ${value} to be string but got: ${typeof value}`;
  }
}

function assertIsFetchResult(value: unknown): asserts value is FetchResult {
  if (typeof value !== 'object') {
    throw 'expected value to be an object';
  }

  const castAsError = value as FetchError;

  if (castAsError.error && !castAsError.account) {
    return;
  }

  const castAsSuccess = value as FetchSuccess;
  if (castAsSuccess.account && !castAsSuccess.error) {
    return;
  }

  throw 'Expected to have returned after resolving object to a FetchResult';
}

export {
  assertIsString,
  assertIsFetchResult
}