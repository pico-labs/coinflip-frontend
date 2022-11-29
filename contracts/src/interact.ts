/**
 * This script can be used to interact with the Add contract, after deploying it.
 *
 * We call the update() method on the contract, create a proof and send it to the chain.
 * The endpoint that we interact with is read from your config.json.
 *
 * This simulates a user interacting with the zkApp from a browser, except that here, sending the transaction happens
 * from the script and we're using your pre-funded zkApp account to pay the transaction fee. In a real web app, the user's wallet
 * would send the transaction and pay the fee.
 *
 * To run locally:
 * Build the project: `$ npm run build`
 * Run with node:     `$ node build/src/interact.js <network>`.
 */
import * as dotenv from 'dotenv';

import {
  Mina,
  PrivateKey,
  PublicKey,
  shutdown,
  isReady,
  fetchAccount,
} from 'snarkyjs';
import { Add } from './Add.js';

dotenv.config();
Error.stackTraceLimit = 1000;

const BERKELEY_ADDRESS =
  'B62qrDe16LotjQhPRMwG12xZ8Yf5ES8ehNzZ25toJV28tE9FmeGq23A';

await isReady;

const Berkeley = Mina.BerkeleyQANet(
  'https://proxy.berkeley.minaexplorer.com/graphql'
);
Mina.setActiveInstance(Berkeley);

let zkAppAddress = PublicKey.fromBase58(BERKELEY_ADDRESS);
let zkApp = new Add(zkAppAddress);

const devPrivateKey: string | undefined = process.env.DEV_PRIVATE_KEY;
if (!devPrivateKey) {
  throw new Error('DEV_PRIVATE_KEY is not defined');
}
let feePayerKey = PrivateKey.fromBase58(devPrivateKey);

let response = await fetchAccount({ publicKey: zkAppAddress });
if (response.error) {
  throw Error(response.error.statusText);
} else {
  const { nonce, balance, publicKey } = response.account;
  console.log(
    `Interacting with contract with nonce: ${nonce}, balance: ${balance}, publicKey: ${publicKey.toBase58()}`
  );
}

// compile the contract to create prover keys
console.log('compile the contract...');
await Add.compile();

const transactionFee = 100_000_000;
console.log('build transaction and update...');
let tx = await Mina.transaction({ feePayerKey, fee: transactionFee }, () => {
  zkApp.update();
});

console.log('proving...');
await tx.prove();

console.log(tx.toGraphqlQuery());
console.log('send transaction...');
let sentTx = await tx.send();

await sentTx.wait();

if (sentTx.hash() !== undefined) {
  console.log(`
Success! Update transaction sent.

Your smart contract state will be updated
as soon as the transaction is included in a block:
https://berkeley.minaexplorer.com/transaction/${sentTx.hash()}
`);
}
shutdown();
