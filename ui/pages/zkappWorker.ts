import {
  Mina,
  isReady,
  PublicKey,
  fetchAccount, PrivateKey, AccountUpdate, UInt64,
} from 'snarkyjs'
import {Account} from 'snarkyjs/src/lib/fetch';

type Transaction = Awaited<ReturnType<typeof Mina.transaction>>;

// ---------------------------------------------------------------------------------------

import type { Add } from '../../contracts/src/Add';
import type { Executor} from 'coinflip-executor-contract/build/src/executor';

type TestAccount = {publicKey: PublicKey, privateKey: PrivateKey};


interface FetchErrorField {
  statusCode: number;
  statusText: string
}

export interface FetchSuccess {
  account: Account;
  error: undefined;
}

export type FetchResult = FetchSuccess | FetchError;

export interface FetchError {
  account: undefined;
  error: FetchErrorField
}

interface State {
  Add:  typeof Add | null;
  zkapp:  Add | null
  transaction: Transaction | null;
  isLocal: boolean;
  testAccounts: Array<TestAccount> | null;
  localAppPrivateKey: PrivateKey | null;
}

const state: State = {
  Add: null as null | typeof Add,
  zkapp: null as null | Add,
  transaction: null as null | Transaction,
  isLocal: false,
  testAccounts: null,
  localAppPrivateKey: null
};

// ---------------------------------------------------------------------------------------

const functions = {
  loadSnarkyJS: async (_args: {}) => {
    await isReady;
  },
  setActiveInstanceToBerkeley: async (_args: {}) => {
    const Berkeley = Mina.BerkeleyQANet(
      "https://proxy.berkeley.minaexplorer.com/graphql"
    );
    Mina.setActiveInstance(Berkeley);
  },
  setActiveInstanceToLocal: async (_args: {}) => {
    const Local = Mina.LocalBlockchain();
    Mina.setActiveInstance(Local);
    state.testAccounts = Local.testAccounts;
    state.isLocal = true;
    state.localAppPrivateKey = PrivateKey.random();
  },
  loadContract: async (_args: {}) => {
    const { Add } = await import('../../contracts/build/src/Add.js');
    const { Executor } =  await import('coinflip-executor-contract/build/src/executor');
    assertsIsSpecifiedContract<Add>(Add, 'Add');
    state.Add = Add;
  },
  compileContract: async (_args: {}) => {
    assertsIsSpecifiedContract<Add>(state.Add, 'Add');
    await state.Add.compile();
  },
  loadBalances: async (args: {publicKeys: Array<string>}): Promise<Array<string>> => {
    return args.publicKeys.map(key => {
      return Mina.getBalance(PublicKey.fromBase58(key)).toString()
    });
  },

  // TODO: JB - I dont think this is working as intended.
  fetchAccount: async (args: { publicKey58: string }): Promise<FetchResult> => {
    if (state.isLocal) {
      console.info(`get account with key: ${args.publicKey58}`);
      const publicKey = PublicKey.fromBase58(args.publicKey58);
      try {
        // In local, we have to use getAccount rather than fetchAccount, since there is no GraphQL endpoint locally.
        // But, that has a different return type than fetchAccount.
        // Therefore, we munge the output to normalize the return type so downstream consumers
        // don't have to behave differently depending on the network.
        const account = Mina.getAccount(publicKey);
        return {account, error: undefined}
      } catch (err) {
        return {account: undefined, error: {statusCode: 9999, statusText: 'Local - could not find account.'}};
      }
    } else {
      const publicKey = PublicKey.fromBase58(args.publicKey58);
      return await fetchAccount({ publicKey });
    }
  },
  initZkappInstance: async (args: { publicKey58: string }) => {
    assertsIsSpecifiedContract<Add>(state.Add, 'Add');
    const publicKey = PublicKey.fromBase58(args.publicKey58);
    state.zkapp = new state.Add(publicKey);
  },
  initLocalZkappInstance: async (args: {userPrivateKey58: string, appPrivateKey58: string}) => {
    assertsIsSpecifiedContract<Add>(state.Add, 'Add');
    const userPrivateKey = PrivateKey.fromBase58(args.userPrivateKey58);
    const appPrivateKey = PrivateKey.fromBase58(args.appPrivateKey58);

    const instance = new state.Add(PublicKey.fromPrivateKey(appPrivateKey));
    let tx = await Mina.transaction(userPrivateKey, () => {
      AccountUpdate.fundNewAccount(userPrivateKey);
      instance.deploy({zkappKey: appPrivateKey});
      instance.init();
    });
    state.zkapp = instance;

    const sentTx = await tx.send();
    await sentTx.wait();

    if (sentTx.hash() !== undefined) {
      console.debug(`DEV - Success! account funded, deployed, initialized`);
    }
  },
  getNum: async (_args: {}) => {
    const currentNum = await state.zkapp!.num.get();
    return JSON.stringify(currentNum.toJSON());
  },
  createUpdateTransaction: async (_args: {}) => {
    const transaction = await Mina.transaction(() => {
        state.zkapp!.update();
      }
    );
    state.transaction = transaction;
  },

  createLocalUpdateTransaction: async (args: {userPrivateKey58: string}) => {
    const feePayerKey = PrivateKey.fromBase58(args.userPrivateKey58);
    const transaction = await Mina.transaction({ feePayerKey, fee: 100_000_000 }, () => {
        state.zkapp!.update();
      }
    );
    state.transaction = transaction;
  },
  proveUpdateTransaction: async (_args: {}) => {
    await state.transaction!.prove();
  },
  getTransactionJSON: async (_args: {}) => {
    return state.transaction!.toJSON();
  },
  getLocalPrivateKey: async (_args: {}) => {
    return state.testAccounts![0].privateKey.toBase58();
  },
  getLocalAppPrivateKey: async (_args: {}) => {
    if (state.isLocal && state.localAppPrivateKey) {
      return state.localAppPrivateKey.toBase58();
    } else {
      throw 'This operation is only supported on local and with a private key initialized; are you on the right network?';
    }
  },
  sendLocalTransaction: async (_args: {}) => {
    const res = await Mina.sendTransaction(state.transaction!)
    return res.hash();
  }
};

// ---------------------------------------------------------------------------------------

function assertsIsSpecifiedContract<S>(contract: unknown, expectedName: string): asserts contract is S {
  if (typeof contract !== 'function') {
    throw 'contract is not a function';
  }

  const castContract = contract as {name: string};
  const namesDiffer = castContract.name !== expectedName;
  if (!castContract.name || namesDiffer) {
    throw `Expected contract to have name '${expectedName}' but got '${contract.name}`;
  }
}

export type WorkerFunctions = keyof typeof functions;

export type ZkappWorkerRequest = {
  id: number,
  fn: WorkerFunctions,
  args: any
}

export type ZkappWorkerReponse = {
  id: number,
  data: any
}
if (process.browser) {
  addEventListener('message', async (event: MessageEvent<ZkappWorkerRequest>) => {
    const returnData = await functions[event.data.fn](event.data.args);

    const message: ZkappWorkerReponse = {
      id: event.data.id,
      data: returnData,
    }
    postMessage(message)
  });
}
