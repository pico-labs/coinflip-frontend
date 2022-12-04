import {PublicKey, Poseidon, Field, MerkleMap, MerkleMapWitness} from 'snarkyjs';
import {ExternalMerkleState} from './datasource';


function initializeMap(knownState: ExternalMerkleState | null): MerkleMap {
  if (!knownState) {
    return new MerkleMap();
  }
  const map = new MerkleMap();
  Object.entries(knownState).map(([key58, value]) => {
    const key = generateMapKey(key58);
    map.set(key, generateMapValue(value.balance));
  });
  return map;
}

function generateMapKey(publicKey: PublicKey | string): Field {
  if (typeof publicKey === 'string') {
    return Poseidon.hash(PublicKey.fromBase58(publicKey).toFields());
  } else {
    return Poseidon.hash(publicKey.toFields());
  }
}

function generateMapValue(value: number): Field {
  return Field(value);
}

export {initializeMap}