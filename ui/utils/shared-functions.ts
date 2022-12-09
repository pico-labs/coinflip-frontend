import { MerkleMap } from "snarkyjs";
import { FetchError, FetchResult, FetchSuccess } from "../pages/zkappWorker";

function assertIsString(value: unknown): asserts value is string {
  if (typeof value !== "string") {
    throw `expected value: ${value} to be string but got: ${typeof value}`;
  }
}

function assertIsStringArray(value: unknown): asserts value is string[] {
  if (typeof value !== "object") {
    throw `expected value: ${value} to have typeof object but got: ${typeof value}`;
  }

  const castValue = value as Array<string>;
  if (castValue[0] && typeof castValue[0] === "string") {
    return;
  } else {
    debugger;
    throw "Expected array of strings";
  }
}

function assertIsFetchResult(value: unknown): asserts value is FetchResult {
  if (typeof value !== "object") {
    throw "expected value to be an object";
  }

  const castAsError = value as FetchError;

  if (castAsError.error && !castAsError.account) {
    return;
  }

  const castAsSuccess = value as FetchSuccess;
  if (castAsSuccess.account && !castAsSuccess.error) {
    return;
  }

  throw "Expected to have returned after resolving object to a FetchResult";
}

function assertIsMerkleMap(value: unknown): asserts value is MerkleMap {
  if (typeof value !== "object") {
    throw "expected value to be an object";
  }

  const castAsMap = value as MerkleMap;
  if (!castAsMap.tree || !castAsMap.getRoot()) {
    throw "Expected Map to have properties .tree and .getRoot()";
  }
}

export {
  assertIsString,
  assertIsFetchResult,
  assertIsStringArray,
  assertIsMerkleMap,
};
