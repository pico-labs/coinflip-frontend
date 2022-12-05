import {
  Mina,
  isReady,
  PublicKey,
  fetchAccount, PrivateKey, AccountUpdate, Poseidon, MerkleMap, Field,
} from 'snarkyjs'
type Account = {} // TODO: JB
type Transaction = Awaited<ReturnType<typeof Mina.transaction>>;
import type { Executor } from 'coinflip-executor-contract/build/src/executor';
import {determineWithdrawAmount, getMerkleValuesExternally, setMerkleValueExternally} from '../utils/datasource';
import {initializeMap} from '../utils/merkle';
import {assertIsMerkleMap} from '../utils/shared-functions';

type TestAccount = { publicKey: PublicKey, privateKey: PrivateKey };

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
  zkapp: Executor | null;
  transaction: Transaction | null;
  isLocal: boolean;
  testAccounts: Array<TestAccount> | null;
  localAppPrivateKey: PrivateKey | null;
  map: MerkleMap | null;
}

const state: State = {
  Executor: null as null | typeof Executor,
  zkapp: null as null | Executor,
  transaction: null as null | Transaction,
  isLocal: false,
  testAccounts: null,
  localAppPrivateKey: null,
  map: null
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
    const Local = Mina.LocalBlockchain({proofsEnabled: true});
    Mina.setActiveInstance(Local);
    state.testAccounts = Local.testAccounts;
    state.isLocal = true;
    state.localAppPrivateKey = PrivateKey.random();
  },
  loadContract: async (_args: {}) => {
    const { Executor } = await import('coinflip-executor-contract/build/src/executor');
    assertsIsSpecifiedContract<Executor>(Executor, 'Executor');
    state.Executor = Executor;
  },
  compileContract: async (_args: {}) => {
    assertsIsSpecifiedContract<Executor>(state.Executor, 'Executor');
    await state.Executor.compile();
  },
  loadBalances: async (args: { publicKeys: Array<string> }): Promise<Array<string>> => {
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
        return { account, error: undefined }
      } catch (err) {
        return { account: undefined, error: { statusCode: 9999, statusText: 'Local - could not find account.' } };
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

    // TODO: JB - add support for berkeley
    const externalMapState = await getMerkleValuesExternally(state.isLocal);
    state.map = initializeMap(externalMapState)  // CD: Note, this is where we would load the persistently-stored map from somewhere else
  },
  initLocalZkappInstance: async (args: { userPrivateKey58: string, appPrivateKey58: string }) => {
    assertsIsSpecifiedContract<Executor>(state.Executor, 'Executor');
    const userPrivateKey = PrivateKey.fromBase58(args.userPrivateKey58);
    const appPrivateKey = PrivateKey.fromBase58(args.appPrivateKey58);

    const executorInstance = new state.Executor(PublicKey.fromPrivateKey(appPrivateKey));
    let tx = await Mina.transaction(userPrivateKey, () => {
      AccountUpdate.fundNewAccount(userPrivateKey);
      executorInstance.deploy({ zkappKey: appPrivateKey });
      executorInstance.init();
    });
    state.zkapp = executorInstance;

    const sentTx = await tx.send();
    await sentTx.wait();

    const externalMapState = await getMerkleValuesExternally(state.isLocal);
    state.map = initializeMap(externalMapState)  // CD: Note, this is where we would load the persistently-stored map from somewhere else
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
  createLocalUpdateTransaction: async (args: { userPrivateKey58: string }) => {
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
  localDeposit: async (args: { depositAmount: number, userPrivateKey58: string }) => {
    assertIsMerkleMap(state.map);
    const userPrivateKey = PrivateKey.fromBase58(args.userPrivateKey58);
    const userPublicKey = PublicKey.fromPrivateKey(userPrivateKey);
    const key = Poseidon.hash(userPublicKey.toFields());
    const witness = state.map.getWitness(key);
    const previousBalanceField = state.map.get(key);
    const depositAmountField = Field(args.depositAmount);

    console.info(args.userPrivateKey58);
    const tx = await Mina.transaction({feePayerKey: userPrivateKey, fee: 1_000_000_000}, () => {
      state.zkapp!.deposit(
        userPublicKey,
        depositAmountField,
        previousBalanceField,
        witness
      );
    });
    console.debug('DEV - proving TX...')
    await tx.prove();
    console.debug('DEV - signing TX...')
    tx.sign([userPrivateKey]);
    console.debug('DEV - sending TX...')
    const sentTx = await tx.send();
    console.info(sentTx);
    console.debug('DEV - waiting...')
    const r = await sentTx.wait();
    console.info(r);
    console.debug(`DEV - TX hash: ${sentTx.hash()}`);
    console.debug(tx.toPretty());
    console.debug(tx.toJSON());


    // from CD: After a successful deposit, we track in the update in the merkle map
    const newBalance = previousBalanceField.add(depositAmountField);
    state.map.set(key, newBalance); // CD: Note, previous balance probably ought not to come from args, but just be read from the map
    // TODO: JB - Make sure this is right.
    await setMerkleValueExternally(userPublicKey, parseInt(newBalance.toString()), state.isLocal);
  },

  localWithdraw: async (args: { userPrivateKey58: string }) => {
    assertIsMerkleMap(state.map);
    const userPrivateKey = PrivateKey.fromBase58(args.userPrivateKey58)
    const userPublicKey = userPrivateKey.toPublicKey()
    const key = Poseidon.hash(userPublicKey.toFields());
    const witness = state.map.getWitness(key);
    const withdrawAmount = await determineWithdrawAmount(userPublicKey, state.isLocal)
    const tx3 = await Mina.transaction({feePayerKey: userPrivateKey, fee: 1_000_000_000}, () => {
      state.zkapp!.withdraw(
        userPrivateKey.toPublicKey(),
        Field(withdrawAmount),
        witness
      );
    });
    console.debug('DEV - proving localWithdraw TX...');
    await tx3.prove();
    console.debug('DEV - sending localWithdraw TX')
    await tx3.send();

    // from CD: after a successful withdrawal, we set to 0.
    state.map.set(key, Field(0));
    await setMerkleValueExternally(userPublicKey, 0, state.isLocal);
  }
};

// ---------------------------------------------------------------------------------------

function assertsIsSpecifiedContract<S>(contract: unknown, expectedName: string): asserts contract is S {
  if (typeof contract !== 'function') {
    throw 'contract is not a function';
  }

  const castContract = contract as { name: string };
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
