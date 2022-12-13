import { PublicKey } from "snarkyjs";
import {
  computeMerkleKeyAndValue,
  deserializeMap,
  ExternalMerkleState,
  getMerkleValuesExternally,
} from "./datasource";

export interface UiInfo {
  rootHash: string;
  publicKey: PublicKey;
  state: ExternalMerkleState;

  merkleKey: string;
  merkleValue: string | undefined;
}

async function rootHashToUiInfo(
  rootHash: string | undefined,
  publicKey: PublicKey
): Promise<UiInfo> {
  if (!rootHash) {
    throw `root hash is undefined for public key: ${publicKey.toBase58()}; unexpected`;
  }

  const [merkleMap, fields] = await getMerkleValuesExternally(rootHash);
  const state = deserializeMap(merkleMap, fields);
  console.debug(`DEV - state: ${JSON.stringify(state)}`);

  const { key, value } = computeMerkleKeyAndValue(state, publicKey);

  return {
    rootHash,
    publicKey,
    state,
    merkleKey: key,
    merkleValue: value,
  };
}

export { rootHashToUiInfo };
