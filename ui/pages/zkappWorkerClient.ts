import { PublicKey, PrivateKey } from "snarkyjs";
import type { OracleResult } from "../utils/OracleDataSource";
import {
  assertIsFetchResult, assertIsLoadRootHashesResult,
  assertIsString,
  assertIsStringArray,
} from "../utils/shared-functions";

import type {
  ZkappWorkerRequest,
  ZkappWorkerReponse,
  WorkerFunctions,
  FetchResult, LoadRootHashesResult,
} from "./zkappWorker";

export default class ZkappWorkerClient {
  // ---------------------------------------------------------------------------------------

  loadSnarkyJS() {
    return this._call("loadSnarkyJS", {});
  }
  async loadBalances(publicKeys: Array<PublicKey>): Promise<Array<string>> {
    const result = await this._call("loadBalances", {
      publicKeys: publicKeys.map((k) => k.toBase58()),
    });
    assertIsStringArray(result);
    return result;
  }

  // TODO: JB - Delete
  // async resetContract(contractPublicKey: PublicKey): Promise<string> {
  //   console.log(`resetContract - ${''}`);
  //   const args = {publicKey58: contractPublicKey.toBase58()};
  //   const result = await this._call('resetContract', args);
  //   assertIsString(result);
  //   console.info(`got new root hash: ${result}`);
  //   return result
  // }

  async loadAccountRootHashes(contractPublicKey: PublicKey, userPublicKey: PublicKey): Promise<LoadRootHashesResult> {
    const result: unknown = await this._call('loadAccountRootHashes', {
      contractKey58: contractPublicKey.toBase58(),
      userKey58: userPublicKey.toBase58()
    });
    assertIsLoadRootHashesResult(result);
    return result;
  }
  setActiveInstanceToBerkeley() {
    return this._call("setActiveInstanceToBerkeley", {});
  }
  setActiveInstanceToLocal() {
    return this._call("setActiveInstanceToLocal", {});
  }

  async getLocalPrivateKey(): Promise<PrivateKey> {
    const privateKey58 = await this._call("getLocalPrivateKey", {});
    assertIsString(privateKey58);
    return PrivateKey.fromBase58(privateKey58);
  }
  async getLocalAppPrivateKey(): Promise<PrivateKey> {
    const privateKey58 = await this._call("getLocalAppPrivateKey", {});
    assertIsString(privateKey58);
    return PrivateKey.fromBase58(privateKey58);
  }

  loadContract() {
    return this._call("loadContract", {});
  }

  compileContract() {
    return this._call("compileContract", {});
  }

  async fetchAccount({
    publicKey,
  }: {
    publicKey: PublicKey;
  }): Promise<FetchResult> {
    const result = await this._call("fetchAccount", {
      publicKey58: publicKey.toBase58(),
    });
    assertIsFetchResult(result);
    return result;
  }

  initZkappInstance(publicKey: PublicKey) {
    return this._call("initZkappInstance", {
      publicKey58: publicKey.toBase58(),
    });
  }

  initLocalZkappInstance(
    userPrivateKey: PrivateKey,
    appPrivateKey: PrivateKey
  ) {
    const args = {
      userPrivateKey58: userPrivateKey.toBase58(),
      appPrivateKey58: appPrivateKey.toBase58(),
    };
    return this._call("initLocalZkappInstance", args);
  }

  deposit(depositAmount: number, userPrivateKey: PrivateKey) {
    const args = { depositAmount, userPrivateKey58: userPrivateKey.toBase58() };
    return this._call("deposit", args);
  }

  withdraw(userPrivateKey: PrivateKey) {
    const args = { userPrivateKey58: userPrivateKey.toBase58() };
    return this._call("withdraw", args);
  }

  flipCoin(userPrivateKey: PrivateKey, oracleResult: OracleResult, executorPrivateKey: PrivateKey) {
    const args = { 
      userPrivateKey58: userPrivateKey.toBase58(),
      oracleResult,
      executorPrivateKey58: executorPrivateKey.toBase58()
    };
    return this._call("flipCoin", args);
  }

  // ---------------------------------------------------------------------------------------

  worker: Worker;

  promises: {
    [id: number]: { resolve: (res: any) => void; reject: (err: any) => void };
  };

  nextId: number;

  constructor() {
    this.worker = new Worker(new URL("./zkappWorker.ts", import.meta.url));
    this.promises = {};
    this.nextId = 0;

    this.worker.onmessage = (event: MessageEvent<ZkappWorkerReponse>) => {
      this.promises[event.data.id].resolve(event.data.data);
      delete this.promises[event.data.id];
    };
  }

  _call(fn: WorkerFunctions, args: any) {
    return new Promise((resolve, reject) => {
      this.promises[this.nextId] = { resolve, reject };

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
