import { PrivateKey, PublicKey } from "snarkyjs";
import { AppState } from "../pages/_app.page";
import ZkappWorkerClient from "../pages/zkappWorkerClient";
import { networkConfig, SUPPORTED_NETWORKS } from "./constants";

interface BaseSetupConfig {
  zkappPublicKey: PublicKey;
  userPrivateKey: PrivateKey;
}

interface BerkeleySetupConfig extends BaseSetupConfig {
  isBerkeley: true;
}

interface LocalSetupConfig extends BaseSetupConfig {
  zkappPrivateKey: PrivateKey;
  isLocal: true;
}

async function setupNetwork(
  network: "BERKELEY" | "LOCAL",
  workerClient: ZkappWorkerClient,
  currentAppState: AppState
): Promise<AppState> {
  if (network === "BERKELEY") {
    await workerClient.setActiveInstanceToBerkeley();
    const config = await generateConfig(
      network,
      workerClient,
      currentAppState.userInputPrivateKey
    );
    return setupAndDeriveState(workerClient, currentAppState, config);
  } else {
    await workerClient.setActiveInstanceToLocal();
    const config = await generateConfig(
      network,
      workerClient,
      currentAppState.userInputPrivateKey
    );
    return setupAndDeriveState(workerClient, currentAppState, config);
  }
}

async function setupAndDeriveState(
  workerClient: ZkappWorkerClient,
  currentAppState: AppState,
  config: BerkeleySetupConfig | LocalSetupConfig
): Promise<AppState> {
  console.log(
    "using user public key:",
    config.userPrivateKey.toPublicKey().toBase58()
  );

  console.log("checking if user account exists...");
  // TODO: JB -- Right now, a non-existent account in Berkeley returns an error object, whereas for local, it throws.
  const res = await workerClient.fetchAccount({
    publicKey: config.userPrivateKey.toPublicKey(),
  });
  const userAccountExists = !res.error;

  await workerClient.loadContract();

  console.log("compiling zkApp");
  await workerClient.compileContract();
  console.log("zkApp compiled");

  if (isBerkeleyConfig(config)) {
    await workerClient.initZkappInstance(config.zkappPublicKey);
  } else {
    const localUserPrivateKey = await workerClient.getLocalPrivateKey();
    await workerClient.initLocalZkappInstance(
      localUserPrivateKey,
      config.zkappPrivateKey
    );
  }

  console.log("getting zkApp state...");
  await workerClient.fetchAccount({ publicKey: config.zkappPublicKey });

  return {
    ...currentAppState,
    zkappWorkerClient: workerClient,
    hasWallet: false,
    hasBeenSetup: true,
    zkappPublicKey: config.zkappPublicKey,
    userAccountExists,
    userInputPrivateKey: config.userPrivateKey,
  };
}

async function generateConfig(
  network: "BERKELEY" | "LOCAL",
  worker: ZkappWorkerClient,
  userPrivateKey?: PrivateKey
): Promise<LocalSetupConfig | BerkeleySetupConfig> {
  if (network === SUPPORTED_NETWORKS.BERKELEY) {
    if (!userPrivateKey) {
      throw "private key must be provided in Berkeley";
    }
    const zkappPublicKey = PublicKey.fromBase58(
      networkConfig.BERKELEY.coinflipContract.publicKey
    );
    return { zkappPublicKey, isBerkeley: true, userPrivateKey };
  } else {
    const zkappPrivateKey = await worker.getLocalAppPrivateKey();
    const userPrivateKey = await worker.getLocalPrivateKey();
    return {
      zkappPrivateKey,
      zkappPublicKey: PublicKey.fromPrivateKey(zkappPrivateKey),
      isLocal: true,
      userPrivateKey,
    };
  }
}

function isBerkeleyConfig(
  config: BerkeleySetupConfig | LocalSetupConfig
): config is BerkeleySetupConfig {
  return "isBerkeley" in config;
}

export { setupNetwork };
