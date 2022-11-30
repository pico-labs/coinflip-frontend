import {
  isReady,
  Mina,
  AccountUpdate,
  PrivateKey,
  shutdown,
  PublicKey,
} from 'snarkyjs';
import { Add } from './Add.js';

await isReady;

const Local = Mina.LocalBlockchain();
Mina.setActiveInstance(Local);

const testAccount = Local.testAccounts[0];
const localPrivateKey = testAccount.privateKey;
const localPublicKey = PublicKey.fromPrivateKey(localPrivateKey);
console.log(
  `Running with pub key: ${localPublicKey.toBase58()} with balance: ${localPublicKey.toJSON()}`
);

const zkAppPrivateKey = PrivateKey.random();
const zkAppAddress = zkAppPrivateKey.toPublicKey();
const zkAppInstance = new Add(zkAppAddress);
console.log(`Running with app with pub key: ${zkAppAddress.toBase58()}`);

console.log('compiling...');
await Add.compile();

console.log('fetching account');
const localAccount = Mina.getAccount(localPublicKey);
console.log(
  `Local account with pub key: ${localPublicKey.toBase58()} has balance: ${localAccount.balance.toString()}`
);

let tx = await Mina.transaction(localPrivateKey, () => {
  AccountUpdate.fundNewAccount(localPrivateKey);
  zkAppInstance.deploy({ zkappKey: zkAppPrivateKey });
  zkAppInstance.init();
});

const sentTx = await tx.send();
await sentTx.wait();

if (sentTx.hash() !== undefined) {
  console.log(`Success! account funded, deployed, initialized`);
}

const initialNumState = new Add(zkAppAddress).num.get();

console.log(`Now, updating account...`);
let updateTx = await Mina.transaction(localPrivateKey, () => {
  zkAppInstance.update();
});

console.log(`proving updateTx...`);
await updateTx.prove();
console.log(`sending updateTx...`);
const sentUpdateTx = await updateTx.send();
await sentUpdateTx.wait();

if (sentUpdateTx.hash() !== undefined) {
  console.log(`Success! updated contract value`);
}

const parsedInitialNumState = parseInt(initialNumState.toString());
const parsedUpdatedNumState = parseInt(
  new Add(zkAppAddress).num.get().toString()
);

if (parsedUpdatedNumState === 3 && parsedInitialNumState === 1) {
  console.log(`Everything worked!`);
} else {
  console.error(
    `parsedUpdatedNumState: ${parsedUpdatedNumState}, parsedInitialNumState: ${parsedInitialNumState}; expected 3 and 1`
  );
}

shutdown();
//# sourceMappingURL=interact-local.js.map
