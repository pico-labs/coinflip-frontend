import { Field, MerkleMap, Poseidon, PublicKey } from "snarkyjs";

const BASE_URL = `https://global-nice-gopher-30365.upstash.io`;
const HEADERS = {
  headers: {
    "Content-Type": "application/json",
    ...generateHeaders(),
  },
};

interface ServerResult {
  result: null | string;
}

export interface ExternalMerkleState {
  [key: string]: string;
}

// TODO: JB make configurable per network
async function setMerkleValueExternally(
  stateRootHash: string,
  publicKey: PublicKey,
  newBalance: number
): Promise<string | null> {
  console.debug(`method name: setMerkleValueExternally`);
  const stored = await getMerkleValuesExternally(stateRootHash);
  const map = stored[0];
  const keys = stored[1];
  const key = Poseidon.hash(publicKey.toFields());
  keys.add(key);
  map.set(key, Field(newBalance));
  const newStateRootHash = map.getRoot();
  const url = `${BASE_URL}/set/${newStateRootHash}`;
  console.debug(`DEV - setting state...`);
  const result = await fetch(url, {
    ...HEADERS,
    method: "POST",
    body: JSON.stringify(deserializeMap(map, keys)),
  });
  const json = (await result.json()) as ServerResult;
  if (json.result) {
    return json.result;
  } else {
    return null;
  }
}

async function getMerkleValuesExternally(
  stateRootHash: string
): Promise<[MerkleMap, Set<Field>]> {
  console.debug(`method name: getMerkleValuesExternally`);
  const url = `${BASE_URL}/get/${stateRootHash}`;
  const result = await fetch(url, { ...HEADERS });
  const json = (await result.json()) as ServerResult;
  if (json.result) {
    console.info("getMerkleValuesExternally json here:");
    console.info(json);
    const jsonState = parseResult(json);
    const state = serializeMap(jsonState);
    console.debug(`DEV - reading state from get: ${jsonState}`);
    return state;
  } else {
    return [new MerkleMap(), new Set()];
  }
}

function parseResult(json: ServerResult): ExternalMerkleState {
  return JSON.parse(json.result as string);
}

function serializeMap(
  externalState: ExternalMerkleState
): [MerkleMap, Set<Field>] {
  console.debug(`method name: serializeMap`);
  const serialized = new MerkleMap();
  const merkleKeys: Set<Field> = new Set();
  Object.keys(externalState).forEach((key) => {
    console.debug(`Key: ${key}: ${externalState[key]}`);
    serialized.set(Field(key), Field(externalState[key]));
    merkleKeys.add(Field(key));
  });

  return [serialized, merkleKeys];
}

function deserializeMap(
  internalState: MerkleMap,
  keys: Set<Field>
): ExternalMerkleState {
  console.debug(`method name: deserializeMap`);
  const deserialized: ExternalMerkleState = {};

  keys.forEach((key) => {
    console.debug(
      `Key: ${key.toString()}: ${internalState.get(key).toString()}`
    );
    deserialized[key.toString()] = internalState.get(key).toString();
  });

  return deserialized;
}

function generateHeaders() {
  const value = [
    "Bearer",
    " ",
    "AXadASQgMz",
    "M1YmFlMjgtYTkyMi00ZmRhLTkwZjgtNzA0ZjhkMjg4OWI2MTMxNDg3M2Y2NjA3NGViNTk4YmU4NmJjMzhjOTBhMzY",
    "=",
  ];

  return {
    Authorization: value.join(""),
  };
}

function computeMerkleKeyAndValue(
  externalState: ExternalMerkleState,
  publicKey: PublicKey
): { key: string; value: string | undefined } {
  const key = Poseidon.hash(publicKey.toFields()).toString();
  const value = externalState[key];
  const result = { key, value };
  return result;
}

export {
  getMerkleValuesExternally,
  setMerkleValueExternally,
  deserializeMap,
  serializeMap,
  computeMerkleKeyAndValue,
};
