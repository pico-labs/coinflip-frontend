import { Executor } from "coinflip-executor-contract";
import {
  Mina,
  isReady,
  PublicKey,
  fetchAccount,
  PrivateKey,
  AccountUpdate,
  Poseidon,
  MerkleMap,
  Field,
  UInt64,
  Signature,
  Int64,
  Group,
  Circuit,
} from "snarkyjs";
type Account = {
  appState?: Field[];
}; // TODO: JB

import type { OracleResult } from "../utils/OracleDataSource";
export interface LoadRootHashesResult {
  contractRoot: string;
  userRoot?: string;
}

type Transaction = Awaited<ReturnType<typeof Mina.transaction>>;
import {
  getMerkleValuesExternally,
  setMerkleValueExternally,
} from "../utils/datasource";
import { assertIsMerkleMap } from "../utils/shared-functions";

const MINA_FEE = 100_000_000;

type TestAccount = { publicKey: PublicKey; privateKey: PrivateKey };

interface FetchErrorField {
  statusCode: number;
  statusText: string;
}

export interface FetchSuccess {
  account: Account;
  error: undefined;
}

export type FetchResult = FetchSuccess | FetchError;

export interface FetchError {
  account: undefined;
  error: FetchErrorField;
}

export type ChannelBalance = {
  player: PublicKey | null;
  executor: PublicKey;
  deltaBalance: Int64;
  nonce: Field;
};

interface State {
  Executor: typeof Executor | null;
  zkapp: Executor | null;
  transaction: Transaction | null;
  isLocal: boolean;
  testAccounts: Array<TestAccount> | null;
  localAppPrivateKey: PrivateKey | null;
  map: MerkleMap | null;
  merkleKeys: Set<Field>;
  contractRootHash: string;
  channelBalance: ChannelBalance | null;
  latestSignedChannelBalance: Signature | null;
}

const state: State = {
  Executor: null as null | typeof Executor,
  zkapp: null as null | Executor,
  transaction: null as null | Transaction,
  isLocal: false,
  testAccounts: null,
  localAppPrivateKey: null,
  map: null,
  merkleKeys: new Set(),
  contractRootHash: "0",
  channelBalance: null,
  latestSignedChannelBalance: null,
};

// ---------------------------------------------------------------------------------------

const functions = {
  loadSnarkyJS: async (_args: {}) => {
    await isReady;
  },
  setActiveInstanceToBerkeley: async (_args: {}) => {
    let Berkeley = Mina.Network(
      "https://proxy.berkeley.minaexplorer.com/graphql"
    );
    Mina.setActiveInstance(Berkeley);
  },
  setActiveInstanceToLocal: async (_args: {}) => {
    const Local = Mina.LocalBlockchain({ proofsEnabled: true });
    Mina.setActiveInstance(Local);

    state.testAccounts = Local.testAccounts;
    state.isLocal = true;
    // @qcomps - another change I made
    const maybePrivateKey58 = process.env.EXECUTOR_PRIVATE_KEY;
    state.localAppPrivateKey = maybePrivateKey58
      ? PrivateKey.fromBase58(maybePrivateKey58)
      : PrivateKey.random();
  },
  loadContract: async (_args: {}) => {
    const { Executor } = await import("coinflip-executor-contract");
    assertsIsSpecifiedContract<Executor>(Executor, "Executor");
    state.Executor = Executor;
  },
  compileContract: async (_args: {}) => {
    assertsIsSpecifiedContract<Executor>(state.Executor, "Executor");
    await state.Executor.compile();
  },
  loadBalances: async (args: {
    publicKeys: Array<string>;
  }): Promise<Array<string>> => {
    return args.publicKeys.map((key) => {
      return Mina.getBalance(PublicKey.fromBase58(key)).toString();
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
        return { account, error: undefined };
      } catch (err) {
        return {
          account: undefined,
          error: {
            statusCode: 9999,
            statusText: "Local - could not find account.",
          },
        };
      }
    } else {
      const publicKey = PublicKey.fromBase58(args.publicKey58);
      return await fetchAccount({ publicKey });
    }
  },
  initZkappInstance: async (args: { publicKey58: string }) => {
    assertsIsSpecifiedContract<Executor>(state.Executor, "Executor");
    const publicKey = PublicKey.fromBase58(args.publicKey58);
    state.zkapp = new state.Executor(publicKey);

    // TODO: JB - add support for berkeley
    const appState = await fetchAccount({ publicKey });
    console.log(`App State: ${appState}`);
    const stateRootHash = appState.account!.appState![0];
    state.contractRootHash = stateRootHash.toString();
    const externalMapState = await getMerkleValuesExternally(
      state.contractRootHash
    );
    state.map = externalMapState[0];
    state.merkleKeys = externalMapState[1];
    state.channelBalance = {
      player: null,
      executor: publicKey,
      deltaBalance: Int64.from(0),
      nonce: Field(0),
    };
  },

  // TODO: JB - This only works with Berkeley for now because fetchAccount requires network.
  loadAccountRootHashes: async (args: {
    contractKey58: string;
    userKey58: string;
  }): Promise<LoadRootHashesResult> => {
    let upToDateContractAccount: Account;
    try {
      upToDateContractAccount = await (
        await fetchAccount({
          publicKey: PublicKey.fromBase58(args.contractKey58),
        })
      ).account!;
    } catch (e) {
      upToDateContractAccount = Mina.getAccount(
        PublicKey.fromBase58(args.contractKey58)
      );
    }

    // weird hack to make sure delta balance is tracked
    if (state.latestSignedChannelBalance) {
      // pass
    } else {
      state.channelBalance!.player = PublicKey.fromBase58(args.userKey58);
      console.debug(
        `Signing: Account: ${Poseidon.hash(
          state.channelBalance!.player!.toFields()
        ).toString()}, Delta Balance: ${state
          .channelBalance!.deltaBalance.toField()
          .toString()}, Nonce: ${
          state.channelBalance!.nonce
        } as ${PrivateKey.fromBase58(process.env.EXECUTOR_PRIVATE_KEY!)
          .toPublicKey()
          .toBase58()}`
      );
      state.latestSignedChannelBalance = Signature.create(
        PrivateKey.fromBase58(process.env.EXECUTOR_PRIVATE_KEY!),
        [
          Poseidon.hash(state.channelBalance!.player!.toFields()),
          state.channelBalance!.deltaBalance.toField(),
          state.channelBalance!.nonce,
        ]
      );
    }
    // end hack

    if (upToDateContractAccount.appState) {
      const contractRootHash = upToDateContractAccount.appState[0].toString();
      const userRootHash = state.map?.getRoot().toString();
      return { contractRoot: contractRootHash, userRoot: userRootHash };
    } else {
      throw "expected contract root hash to be defined.";
    }
  },
  initLocalZkappInstance: async (args: {
    userPrivateKey58: string;
    appPrivateKey58: string;
  }) => {
    assertsIsSpecifiedContract<Executor>(state.Executor, "Executor");
    const userPrivateKey = PrivateKey.fromBase58(args.userPrivateKey58);
    const appPrivateKey = PrivateKey.fromBase58(args.appPrivateKey58);

    const executorInstance = new state.Executor(
      PublicKey.fromPrivateKey(appPrivateKey)
    );
    let tx = await Mina.transaction(userPrivateKey, () => {
      AccountUpdate.fundNewAccount(userPrivateKey);
      executorInstance.deploy({ zkappKey: appPrivateKey });
      executorInstance.init();
    });
    state.zkapp = executorInstance;

    const sentTx = await tx.send();
    await sentTx.wait();

    let tx2 = await Mina.transaction(userPrivateKey, () => {
      executorInstance.updateRandomnessOracle(
        appPrivateKey,
        PublicKey.fromBase58(
          "B62qpvpwLbLDTLQvA2EVBrX5QXmTQ7yy9442KhCj8R1zAk21LuVKtwd"
        )
      );
    });
    await tx2.prove();
    const sentTx2 = await tx2.send();
    await sentTx2.wait();

    const stateRootHash = Mina.getAccount(state.zkapp!.address).appState![0];
    state.contractRootHash = stateRootHash.toString();
    const externalMapState = await getMerkleValuesExternally(
      state.contractRootHash
    );
    state.map = externalMapState[0];
    state.merkleKeys = externalMapState[1];
    state.channelBalance = {
      player: null,
      executor: executorInstance.address,
      deltaBalance: Int64.from(0),
      nonce: Field(0),
    };
    if (sentTx.hash() !== undefined) {
      console.debug(`DEV - Success! account funded, deployed, initialized`);
    }
  },
  getLocalPrivateKey: async (_args: {}) => {
    return state.testAccounts![0].privateKey.toBase58();
  },
  getLocalAppPrivateKey: async (_args: {}) => {
    if (state.isLocal && state.localAppPrivateKey) {
      return state.localAppPrivateKey.toBase58();
    } else {
      throw "This operation is only supported on local and with a private key initialized; are you on the right network?";
    }
  },
  deposit: async (args: {
    depositAmount: number;
    userPrivateKey58: string;
  }) => {
    assertIsMerkleMap(state.map);
    const userPrivateKey = PrivateKey.fromBase58(args.userPrivateKey58);
    const userPublicKey = PublicKey.fromPrivateKey(userPrivateKey);
    const key = Poseidon.hash(userPublicKey.toFields());
    const witness = state.map.getWitness(key);
    const previousBalanceField = state.map.get(key);
    const depositAmountField = Field(args.depositAmount);

    const tx = await Mina.transaction(
      { feePayerKey: userPrivateKey, fee: MINA_FEE },
      () => {
        state.zkapp!.addCollateral(
          userPublicKey,
          depositAmountField,
          previousBalanceField,
          witness
        );
      }
    );
    console.debug("DEV - proving TX...");
    await tx.prove();
    console.debug("DEV - signing TX...");
    tx.sign([userPrivateKey]);
    console.debug("DEV - sending TX...");
    const sentTx = await tx.send();
    console.info(sentTx);
    console.debug("DEV - waiting...");
    const r = await sentTx.wait();
    console.info(r);
    console.debug(`DEV - TX hash: ${sentTx.hash()}`);
    console.debug(tx.toPretty());
    console.debug(tx.toJSON());

    // from CD: After a successful deposit, we track in the update in the merkle map
    const newBalance = previousBalanceField.add(depositAmountField);
    state.map.set(key, newBalance); // CD: Note, previous balance probably ought not to come from args, but just be read from the map
    // TODO: JB - Make sure this is right.
    state.channelBalance!.player = userPublicKey;

    console.debug(
      `Signing: Account: ${Poseidon.hash(
        userPublicKey.toFields()
      ).toString()}, Delta Balance: ${state
        .channelBalance!.deltaBalance.toField()
        .toString()}, Nonce: ${
        state.channelBalance!.nonce
      } as ${PrivateKey.fromBase58(process.env.EXECUTOR_PRIVATE_KEY!)
        .toPublicKey()
        .toBase58()}`
    );
    state.latestSignedChannelBalance = Signature.create(
      PrivateKey.fromBase58(process.env.EXECUTOR_PRIVATE_KEY!),
      [
        Poseidon.hash(userPublicKey.toFields()),
        state.channelBalance!.deltaBalance.toField(),
        state.channelBalance!.nonce,
      ]
    );
    await setMerkleValueExternally(
      state.contractRootHash,
      userPublicKey,
      parseInt(newBalance.toString())
    );
  },

  withdraw: async (args: { userPrivateKey58: string }) => {
    assertIsMerkleMap(state.map);
    const userPrivateKey = PrivateKey.fromBase58(args.userPrivateKey58);
    const userPublicKey = userPrivateKey.toPublicKey();
    const key = Poseidon.hash(userPublicKey.toFields());
    const witness = state.map.getWitness(key);
    const tx3 = await Mina.transaction(
      { feePayerKey: userPrivateKey, fee: 100_000_000 },
      () => {
        state.zkapp!.removeCollateral(
          userPrivateKey.toPublicKey(),
          state.map!.get(key),
          witness,
          state.channelBalance!.deltaBalance,
          state.channelBalance!.nonce,
          state.latestSignedChannelBalance!
        );
      }
    );
    console.debug("DEV - proving withdraw TX...");
    await tx3.prove();
    console.debug("DEV - sending withdraw TX");
    await tx3.send();

    // from CD: after a successful withdrawal, we set to 0.
    state.map.set(key, Field(0));
    await setMerkleValueExternally(state.contractRootHash, userPublicKey, 0);
    state.channelBalance!.deltaBalance = Int64.from(0);
    state.channelBalance!.nonce = Field(0);
    state.latestSignedChannelBalance = Signature.create(
      PrivateKey.fromBase58(process.env.EXECUTOR_PRIVATE_KEY!),
      [
        Poseidon.hash(userPublicKey.toFields()),
        state.channelBalance!.deltaBalance.toField(),
        state.channelBalance!.nonce,
      ]
    );
  },
  flipCoin: async (args: {
    userPrivateKey58: string;
    oracleResult: OracleResult;
    executorPrivateKey58: string;
  }): Promise<string> => {
    console.info("Method Name: flipCoin");
    assertIsMerkleMap(state.map);
    const userPrivateKey = PrivateKey.fromBase58(args.userPrivateKey58);
    const executorPrivateKey = PrivateKey.fromBase58(args.executorPrivateKey58);
    const userPublicKey = userPrivateKey.toPublicKey();
    state.channelBalance!.player = userPublicKey;
    const key = Poseidon.hash(userPublicKey.toFields());
    const witness = state.map.getWitness(key);
    const randomnessSignature = Signature.fromJSON(args.oracleResult.signature);
    const callData = {
      user: userPublicKey,
      balance: state.map!.get(key),
      witness: "...",
      deltaBalance: state.channelBalance!.deltaBalance.toString(),
      nonce: state.channelBalance!.nonce.toString(),
      channelBalanceSig: state.latestSignedChannelBalance!.toJSON(),
      randomnessSig: randomnessSignature.toJSON(),
      ct1: Field(args.oracleResult.cipherText[0]).toString(),
      ct2: Field(args.oracleResult.cipherText[1]).toString(),
      group: Group.fromJSON(args.oracleResult.publicKey)!.toJSON(),
      executorPrivateKey: executorPrivateKey.toBase58(),
    };
    console.info(`Flipping with: ${JSON.stringify(callData)}`);
    let resp: [Int64, Field] = [Int64.from(0), Field(0)];
    Circuit.runAndCheck(() => {
      resp = state.zkapp!.flipCoin(
        userPublicKey,
        state.map!.get(key),
        witness,
        state.channelBalance!.deltaBalance,
        state.channelBalance!.nonce,
        state.latestSignedChannelBalance!,
        randomnessSignature,
        Field(args.oracleResult.cipherText[0]),
        Field(args.oracleResult.cipherText[1]),
        Group.fromJSON(args.oracleResult.publicKey)!,
        executorPrivateKey
      );
    });
    console.log(
      `Winnings: ${resp[0].toString()}, Random Number: ${resp[1].toString()}`
    );
    state.channelBalance!.deltaBalance = state.channelBalance!.deltaBalance.add(
      Int64.from(resp[0])
    );
    state.channelBalance!.nonce = state.channelBalance!.nonce.add(1);
    console.info(
      `New Channel Delta Balance: ${state.channelBalance!.deltaBalance.toString()}`
    );
    console.info(
      `New Channel Nonce: ${state.channelBalance!.nonce.toString()}`
    );

    // Setting the new channel balance based on the outcome of the flip.  Next flip will use this signature as input
    console.debug(
      `Signing: Account: ${Poseidon.hash(
        userPublicKey.toFields()
      ).toString()}, Delta Balance: ${state
        .channelBalance!.deltaBalance.toField()
        .toString()}, Nonce: ${
        state.channelBalance!.nonce
      } as ${PrivateKey.fromBase58(process.env.EXECUTOR_PRIVATE_KEY!)
        .toPublicKey()
        .toBase58()}`
    );
    state.latestSignedChannelBalance = Signature.create(
      PrivateKey.fromBase58(process.env.EXECUTOR_PRIVATE_KEY!),
      [
        Poseidon.hash(userPublicKey.toFields()),
        state.channelBalance!.deltaBalance.toField(),
        state.channelBalance!.nonce,
      ]
    );

    const balance = state.channelBalance;

    return JSON.stringify({
      deltaBalance: balance?.deltaBalance,
      nonce: balance?.nonce,
      player: balance?.player?.toBase58(),
      executor: balance?.executor.toBase58(),
    });
  },
};

// ---------------------------------------------------------------------------------------

function assertsIsSpecifiedContract<S>(
  contract: unknown,
  expectedName: string
): asserts contract is S {
  if (typeof contract !== "function") {
    throw "contract is not a function";
  }

  const castContract = contract as { name: string };
  const namesDiffer = castContract.name !== expectedName;
  if (!castContract.name || namesDiffer) {
    throw `Expected contract to have name '${expectedName}' but got '${contract.name}`;
  }
}

export type WorkerFunctions = keyof typeof functions;

export type ZkappWorkerRequest = {
  id: number;
  fn: WorkerFunctions;
  args: any;
};

export type ZkappWorkerReponse = {
  id: number;
  data: any;
};
if (process.browser) {
  addEventListener(
    "message",
    async (event: MessageEvent<ZkappWorkerRequest>) => {
      const returnData = await functions[event.data.fn](event.data.args);

      const message: ZkappWorkerReponse = {
        id: event.data.id,
        data: returnData,
      };
      postMessage(message);
    }
  );
}
