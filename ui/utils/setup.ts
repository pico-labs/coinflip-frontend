import { PrivateKey, PublicKey} from 'snarkyjs';
import {AppState} from '../pages/_app.page';
import ZkappWorkerClient from '../pages/zkappWorkerClient';
import {networkConfig, SUPPORTED_NETWORKS} from './constants';

export interface MinaBrowserClient {
  requestAccounts: () => Promise<Array<string>>
}

interface BaseSetupConfig {
  userPublicKey: PublicKey;
  zkappPublicKey: PublicKey;
}

interface BerkeleySetupConfig extends BaseSetupConfig {
  isBerkeley: true;
}

interface LocalSetupConfig extends BaseSetupConfig {
  zkappPrivateKey: PrivateKey
  isLocal: true;
}

async function setupNetwork(network: 'BERKELEY' | 'LOCAL', mina: MinaBrowserClient, workerClient: ZkappWorkerClient, currentAppState: AppState): Promise<AppState> {
  if (Object.keys(SUPPORTED_NETWORKS).includes(network)) {
    network === 'BERKELEY' ? await workerClient.setActiveInstanceToBerkeley() : await workerClient.setActiveInstanceToLocal();
    const config = await generateConfig(network, mina, workerClient);
    return setupAndDeriveState(workerClient, currentAppState, mina, config);
  } else {
    throw 'only berkeley and local are supported';
  }
}

async function setupAndDeriveState(workerClient: ZkappWorkerClient, currentAppState: AppState, mina: MinaBrowserClient, config: BerkeleySetupConfig | LocalSetupConfig): Promise<AppState> {
  console.log('using user public key:', config.userPublicKey.toBase58());

  console.log('checking if user account exists...');
  // TODO: JB -- Right now, a non-existent account in Berkeley returns an error object, whereas for local, it throws.
  const res = await workerClient.fetchAccount({ publicKey: config.userPublicKey });
  const userAccountExists = !res.error;

  await workerClient.loadContract();

  console.log('compiling zkApp');
  await workerClient.compileContract();
  console.log('zkApp compiled');

  if (isBerkeleyConfig(config)) {
    await workerClient.initZkappInstance(config.zkappPublicKey);
  } else {
    const localUserPrivateKey = await workerClient.getLocalPrivateKey();
    await workerClient.initLocalZkappInstance(localUserPrivateKey, config.zkappPrivateKey);
  }

  console.log('getting zkApp state...');
  await workerClient.fetchAccount({ publicKey: config.zkappPublicKey });
  const currentNum = await workerClient.getNum();
  console.log('current state:', currentNum.toString());

  return {
    ...currentAppState,
    zkappWorkerClient: workerClient,
    hasWallet: true,
    hasBeenSetup: true,
    publicKey: config.userPublicKey,
    zkappPublicKey: config.zkappPublicKey,
    userAccountExists,
    currentNum
  }
}

async function generateConfig(network: 'BERKELEY' | 'LOCAL', mina: MinaBrowserClient, worker: ZkappWorkerClient): Promise<LocalSetupConfig | BerkeleySetupConfig> {
  if (network === SUPPORTED_NETWORKS.BERKELEY) {
    const userPublicKeyBase58 = (await mina.requestAccounts())[0];
    const userPublicKey = PublicKey.fromBase58(userPublicKeyBase58);
    // TODO: JB - NEED TO CHANGE FOR OUR CONTRACT ONCE DEPLOYED.
    const zkappPublicKey = PublicKey.fromBase58(networkConfig.BERKELEY.coinflipContract.publicKey);
    return {userPublicKey, zkappPublicKey, isBerkeley: true};
  } else if (network === SUPPORTED_NETWORKS.LOCAL) {
    const zkappPrivateKey = await worker.getLocalAppPrivateKey();
    return {
      userPublicKey: PublicKey.fromPrivateKey(await worker.getLocalPrivateKey()),
      zkappPrivateKey,
      zkappPublicKey: PublicKey.fromPrivateKey(zkappPrivateKey),
      isLocal: true
    }
  } else {
    throw 'only berkeley and local are supported';
  }
}

function isBerkeleyConfig(config: BerkeleySetupConfig | LocalSetupConfig): config is BerkeleySetupConfig {
  return 'isBerkeley' in config;
}

export {setupNetwork}