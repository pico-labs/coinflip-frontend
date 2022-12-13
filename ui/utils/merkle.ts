import { PublicKey, Poseidon, Field } from "snarkyjs";

// TODO: JB - Delete later.
function generateMapKey(publicKey: PublicKey | string): Field {
  if (typeof publicKey === "string") {
    return Poseidon.hash(PublicKey.fromBase58(publicKey).toFields());
  } else {
    return Poseidon.hash(publicKey.toFields());
  }
}

function generateMapValue(value: number): Field {
  return Field(value);
}
