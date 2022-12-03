import {
  Mina,
  isReady,
  PublicKey,
  fetchAccount, PrivateKey, AccountUpdate, UInt64, MerkleMapWitness, Poseidon, MerkleMap, Field,
} from 'snarkyjs'

// TODO: JB
type Account = {}
type Transaction = Awaited<ReturnType<typeof Mina.transaction>>;

// ---------------------------------------------------------------------------------------

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
  Executor: typeof Executor | null;
  zkapp:  Executor | null;
  transaction: Transaction | null;
  isLocal: boolean;
  testAccounts: Array<TestAccount> | null;
  localAppPrivateKey: PrivateKey | null;
}

const state: State = {
  Executor: null as null | typeof Executor,
  zkapp: null as null | Executor,
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
    // TODO: JB
    const Local = Mina.LocalBlockchain({proofsEnabled: false});
    Mina.setActiveInstance(Local);
    state.testAccounts = Local.testAccounts;
    state.isLocal = true;
    state.localAppPrivateKey = PrivateKey.random();
  },
  loadContract: async (_args: {}) => {
    const { Executor } =  await import('coinflip-executor-contract/build/src/executor');
    assertsIsSpecifiedContract<Executor>(Executor, 'Executor');
    state.Executor = Executor;
  },
  compileContract: async (_args: {}) => {
    assertsIsSpecifiedContract<Executor>(state.Executor, 'Executor');
    await state.Executor.compile();
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
    assertsIsSpecifiedContract<Executor>(state.Executor, 'Executor');
    const publicKey = PublicKey.fromBase58(args.publicKey58);
    state.zkapp = new state.Executor(publicKey);
  },
  initLocalZkappInstance: async (args: {userPrivateKey58: string, appPrivateKey58: string}) => {
    assertsIsSpecifiedContract<Executor>(state.Executor, 'Executor');
    const userPrivateKey = PrivateKey.fromBase58(args.userPrivateKey58);
    const appPrivateKey = PrivateKey.fromBase58(args.appPrivateKey58);

    const executorInstance = new state.Executor(PublicKey.fromPrivateKey(appPrivateKey));
    let tx = await Mina.transaction(userPrivateKey, () => {
      AccountUpdate.fundNewAccount(userPrivateKey);
      executorInstance.deploy({zkappKey: appPrivateKey});
      executorInstance.init();
    });
    state.zkapp = executorInstance;

    const sentTx = await tx.send();
    await sentTx.wait();

    if (sentTx.hash() !== undefined) {
      console.debug(`DEV - Success! account funded, deployed, initialized`);
    }
  },
  // TODO: JB
  getNum: async (_args: {}) => {
    // const currentNum = await state.zkapp!.num.get();
    // return JSON.stringify(currentNum.toJSON());
    return JSON.stringify(999);
  },
  // TODO: JB handle for executor state
  createUpdateTransaction: async (_args: {}) => {
    const transaction = await Mina.transaction(() => {
      // TODO: JB
      // @ts-ignore
        state.zkapp!.update();
      }
    );
    state.transaction = transaction;
  },

  // TODO: JB - Handle for executor
  createLocalUpdateTransaction: async (args: {userPrivateKey58: string}) => {
    const feePayerKey = PrivateKey.fromBase58(args.userPrivateKey58);
    const transaction = await Mina.transaction({ feePayerKey, fee: 100_000_000 }, () => {
      // TODO: JB
      // @ts-ignore
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
  },
  localDeposit: async (args: {depositAmount: number, previousBalance: number, userPrivateKey58: string}) => {
    if (!state.isLocal) { throw 'only supported for local'}
    const userPrivateKey = PrivateKey.fromBase58(args.userPrivateKey58);
    const userPublicKey = PublicKey.fromPrivateKey(userPrivateKey);
    const merkleMap = new MerkleMap();
    const key = Poseidon.hash(userPublicKey.toFields());
    const witness = merkleMap.getWitness(key);

    const tx = await Mina.transaction(userPrivateKey, () => {
      state.zkapp!.deposit(
        userPublicKey,
        Field(args.depositAmount),
        Field(args.previousBalance),
        witness
      );
    });
    console.debug('DEV - proving TX...')
    await tx.prove();
    console.debug('DEV - signing TX...')
    tx.sign([userPrivateKey]);
    console.debug('DEV - sending TX...')
    const sentTx = await tx.send();
    console.debug('DEV - waiting...')
    await sentTx.wait();
    console.debug(`DEV - TX hash: ${sentTx.hash}`);
  },
  // TODO: JB - Not sure what is supposed to happen when:
  // 1. User sends 2000
  // 2. User sends 3000
  // 3. User flips coin for 1000
  // 4. User loses 1000
  // 5. What amount does the user submit for their withdrawal? It must be (2000 + 3000 - 1000), right? How does the user know how to compute that
  // amount? Is the coinflip function going to return a value that allows us to compute the differential (e.g. -1000 or +1000) ?

  localWithdraw: async (args: {userPrivateKey58: string, withdrawAmount: number}) => {
    if (!state.isLocal) { throw 'only local supported'}
    const userPrivateKey = PrivateKey.fromBase58(args.userPrivateKey58)
    const merkleMap = new MerkleMap();
    const key = Poseidon.hash(userPrivateKey.toPublicKey().toFields());
    const witness = merkleMap.getWitness(key);
    const tx3 = await Mina.transaction(userPrivateKey, () => {
      state.zkapp!.withdraw(
        userPrivateKey.toPublicKey(),
        Field(args.withdrawAmount),
        witness
      );
    });
    console.debug('DEV - proving localWithdraw TX...');
    await tx3.prove();
    console.debug('DEV - sending localWithdraw TX')
    await tx3.send();
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
