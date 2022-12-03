import {
  PublicKey,
  PrivateKey,
  Field,
} from 'snarkyjs'
import {assertIsFetchResult, assertIsString, assertIsStringArray} from '../utils/shared-functions';

import type {
  ZkappWorkerRequest,
  ZkappWorkerReponse,
  WorkerFunctions,
  FetchResult
} from './zkappWorker';

export default class ZkappWorkerClient {

  // ---------------------------------------------------------------------------------------

  loadSnarkyJS() {
    return this._call('loadSnarkyJS', {});
  }
  async loadBalances(publicKeys: Array<PublicKey>): Promise<Array<string>> {
    const result = await this._call('loadBalances', {publicKeys: publicKeys.map(k => k.toBase58())});
    assertIsStringArray(result);
    return result;
  }

  setActiveInstanceToBerkeley() {
    return this._call('setActiveInstanceToBerkeley', {});
  }
  setActiveInstanceToLocal() {
    return this._call('setActiveInstanceToLocal', {});
  }
  async getLocalPrivateKey(): Promise<PrivateKey> {
    const privateKey58 = await this._call('getLocalPrivateKey', {});
    assertIsString(privateKey58);
    return PrivateKey.fromBase58(privateKey58);
  }
  async getLocalAppPrivateKey(): Promise<PrivateKey> {
    const privateKey58 = await this._call('getLocalAppPrivateKey', {});
    assertIsString(privateKey58);
    return PrivateKey.fromBase58(privateKey58);
  }

  loadContract() {
    return this._call('loadContract', {});
  }

  compileContract() {
    return this._call('compileContract', {});
  }

  async fetchAccount({ publicKey }: { publicKey: PublicKey }): Promise<FetchResult> {
    const result = await this._call('fetchAccount', { publicKey58: publicKey.toBase58() });
    assertIsFetchResult(result);
    return result;
  }

  initZkappInstance(publicKey: PublicKey) {
    return this._call('initZkappInstance', { publicKey58: publicKey.toBase58() });
  }

  initLocalZkappInstance(userPrivateKey: PrivateKey, appPrivateKey: PrivateKey) {
    const args = {userPrivateKey58: userPrivateKey.toBase58(), appPrivateKey58: appPrivateKey.toBase58()}
    return this._call('initLocalZkappInstance', args);
  }

  localDeposit(depositAmount: number, previousBalance: number, userPrivateKey: PrivateKey) {
    const args = {depositAmount, previousBalance, userPrivateKey58: userPrivateKey.toBase58()};
    return this._call('localDeposit', args);
  }

  createLocalUpdateTransaction(userPrivateKey: PrivateKey) {
    const args = {userPrivateKey58: userPrivateKey.toBase58()}
    return this._call('createLocalUpdateTransaction', args);
  }

  async sendLocalTransaction(): Promise<string> {
    const result = await this._call('sendLocalTransaction', {});
    assertIsString(result);
    return result
  }

  async getNum(): Promise<Field> {
    const result = await this._call('getNum', {});
    return Field.fromJSON(JSON.parse(result as string));
  }

  createUpdateTransaction() {
    return this._call('createUpdateTransaction', {});
  }

  proveUpdateTransaction() {
    return this._call('proveUpdateTransaction', {});
  }

  async getTransactionJSON() {
    const result = await this._call('getTransactionJSON', {});
    return result;
  }

  // ---------------------------------------------------------------------------------------

  worker: Worker;

  promises: { [id: number]: { resolve: (res: any) => void, reject: (err: any) => void } };

  nextId: number;

  constructor() {
    this.worker = new Worker(new URL('./zkappWorker.ts', import.meta.url))
    this.promises = {};
    this.nextId = 0;

    this.worker.onmessage = (event: MessageEvent<ZkappWorkerReponse>) => {
      this.promises[event.data.id].resolve(event.data.data);
      delete this.promises[event.data.id];
    };
  }

  _call(fn: WorkerFunctions, args: any) {
    return new Promise((resolve, reject) => {
      this.promises[this.nextId] = { resolve, reject }

      const message: ZkappWorkerRequest = {
        id: this.nextId,
        fn,
        args,
      };

      this.worker.postMessage(message);

      this.nextId++;
    });
  }
}

