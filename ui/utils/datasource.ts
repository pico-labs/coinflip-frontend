import {Field, PublicKey} from 'snarkyjs';
import {networkConfig} from './constants';

const BASE_URL = `https://global-nice-gopher-30365.upstash.io`
const HEADERS = {
  headers: {
    'Content-Type': 'application/json',
    ...generateHeaders()
  }
}

interface ServerResult {
  result: null | string;
}

interface PublicKeyMerkleState {
  balance: number;
}
export interface ExternalMerkleState {
  [key: string]: PublicKeyMerkleState
}


// TODO: JB make configurable per network
async function setMerkleValueExternally(publicKey: PublicKey, newBalance: number, isLocal: boolean): Promise<string | null> {
  console.debug(`method name: setMerkleValueExternally`);
  const existingMapFromStorage = await getMerkleValuesExternally(isLocal);
  const updatedMap = existingMapFromStorage ? updateMap(existingMapFromStorage, publicKey, newBalance) : updateMap(null, publicKey, newBalance);
  const networkKey = isLocal ? networkConfig.Local.coinflipContract.datastoreKey : networkConfig.Berkeley.coinflipContract.datastoreKey
  const url = `${BASE_URL}/set/${networkKey}`;
  console.debug(`DEV - setting state...`);
  const result = await fetch(url, {...HEADERS, method: 'POST', body: JSON.stringify(updatedMap)});
  const json  = (await result.json() as ServerResult);
  if (json.result) {
    return json.result;
  } else {
    return null;
  }
}


async function getMerkleValuesExternally(isLocal: boolean): Promise<null | ExternalMerkleState> {
  console.debug(`method name: getMerkleValuesExternally`);
  const networkKey = isLocal ? networkConfig.Local.coinflipContract.datastoreKey : networkConfig.Berkeley.coinflipContract.datastoreKey
  const url = `${BASE_URL}/get/${networkKey}`;
  const result = await fetch(url, {...HEADERS});
  const json  = (await result.json() as ServerResult);
  if (json.result) {
    const state = parseResult(json);
    console.debug(`DEV - reading state from get: ${state}`)
    return state;
  } else {
    return null;
  }
}

function parseResult(json: ServerResult): ExternalMerkleState {
  return JSON.parse(json.result as string);
}

async function determineWithdrawAmount(key: PublicKey, isLocal: boolean): Promise<Field> {
  const stateValues = await getMerkleValuesExternally(isLocal);
  if (stateValues) {
    const balanceToWithdraw = stateValues[key.toBase58()].balance;
    if (!balanceToWithdraw) {
      throw `Could not find public key: ${key.toBase58()} in map of user balances`;
    } else {
      return Field(balanceToWithdraw);
    }
  } else {
    // throw 'should never occur (actually can happen if I just withdraw without having deposited)';
    return Field(0);
  }
}

function updateMap(existingMap: ExternalMerkleState | null, publicKey: PublicKey, newBalance: number): ExternalMerkleState {
  if (existingMap) {
    existingMap[publicKey.toBase58()] = { balance: newBalance};
    return existingMap;
  } else {
    return { [publicKey.toBase58()]: {balance: newBalance}};
  }
}

async function clearState() {
  const url = `${BASE_URL}/flushdb/`;
  console.debug(`DEV - setting state...`);
  await fetch(url, {...HEADERS, method: 'POST'});
  console.debug(`DEV - Flushed DB`);
}

function generateHeaders() {
  const value = ['Bearer', ' ','AXadASQgMz', 'M1YmFlMjgtYTkyMi00ZmRhLTkwZjgtNzA0ZjhkMjg4OWI2MTMxNDg3M2Y2NjA3NGViNTk4YmU4NmJjMzhjOTBhMzY', '=']

  return {
    Authorization: value.join('')
  }
}


export {getMerkleValuesExternally, setMerkleValueExternally, determineWithdrawAmount, clearState};