import {Field, PublicKey} from 'snarkyjs';
import {AppState} from '../pages/_app.page';
import ZkappWorkerClient from '../pages/zkappWorkerClient';
import {networkConfig} from './constants';

// interface SetupBerkeleyState {
//   zkappWorkerClient: ZkappWorkerClient,
//   hasWallet: boolean,
//   hasBeenSetup: boolean,
//   publicKey: PublicKey,
//   zkappPublicKey: PublicKey,
//   accountExists: boolean,
//   currentNum: Field
// }

// TODO: JB
async function setupBerkeley(workerClient: ZkappWorkerClient, currentAppState: AppState, mina: any): Promise<AppState> {
  await workerClient.setActiveInstanceToBerkeley();

  const publicKeyBase58 : string = (await mina.requestAccounts())[0];
  const publicKey = PublicKey.fromBase58(publicKeyBase58);

  console.log('using key', publicKey.toBase58());

  console.log('checking if user account exists...');
  const res = await workerClient.fetchAccount({ publicKey: publicKey! });
  const accountExists = res.error == null;

  await workerClient.loadContract();

  console.log('compiling zkApp');
  await workerClient.compileContract();
  console.log('zkApp compiled');

  const zkappPublicKey = PublicKey.fromBase58(networkConfig.Berkeley.addContract.publicKey);

  await workerClient.initZkappInstance(zkappPublicKey);

  console.log('getting zkApp state...');
  await workerClient.fetchAccount({ publicKey: zkappPublicKey })
  const currentNum = await workerClient.getNum();
  console.log('current state:', currentNum.toString());

  return {
    ...currentAppState,
    zkappWorkerClient: workerClient,
    hasWallet: true,
    hasBeenSetup: true,
    publicKey,
    zkappPublicKey,
    accountExists,
    currentNum
  }
}

export {setupBerkeley}