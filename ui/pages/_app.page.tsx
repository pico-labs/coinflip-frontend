import '../styles/globals.css'
import { useEffect, useState } from "react";
import './reactCOIServiceWorker';
import {SUPPORTED_NETWORKS} from '../utils/constants';
import {setupNetwork} from '../utils/setup';

import ZkappWorkerClient from './zkappWorkerClient';

import {
  PublicKey,
  Field,
} from 'snarkyjs'

export interface AppState {
  zkappWorkerClient: null | ZkappWorkerClient,
  hasWallet: null | boolean,
  hasBeenSetup: boolean,
  accountExists: boolean,
  currentNum: Field | null,
  publicKey: PublicKey | null,
  zkappPublicKey: PublicKey | null,
  creatingTransaction: boolean
}

// const NETWORK = 'BERKELEY';
const NETWORK = 'LOCAL';

export default function App() {
  let [state, setState] = useState<AppState>({
    zkappWorkerClient: null as null | ZkappWorkerClient,
    hasWallet: null as null | boolean,
    hasBeenSetup: false,
    accountExists: false,
    currentNum: null as null | Field,
    publicKey: null as null | PublicKey,
    zkappPublicKey: null as null | PublicKey,
    creatingTransaction: false,
  });

  useEffect(() => {
    (async () => {
      if (!state.hasBeenSetup) {
        const zkappWorkerClient = new ZkappWorkerClient();

        console.log('Loading SnarkyJS...');
        await zkappWorkerClient.loadSnarkyJS();
        console.log('done');

        const mina = (window as any).mina;
        if (mina == null) {
          setState({ ...state, hasWallet: false });
          return;
        } else {
          const setupState = await setupNetwork(NETWORK, mina, zkappWorkerClient, state);
          setState({...setupState});
        }
      }
    })();
  }, []);

  useEffect(() => {
    (async () => {
      if (state.hasBeenSetup && !state.accountExists) {
        for (;;) {
          console.log('checking if account exists...');
          const res = await state.zkappWorkerClient!.fetchAccount({ publicKey: state.publicKey! })
          const accountExists = res.error == null;
          if (accountExists) {
            break;
          }
          await new Promise((resolve) => setTimeout(resolve, 5000));
        }
        setState({ ...state, accountExists: true });
      }
    })();
  }, [state.hasBeenSetup]);

  // -------------------------------------------------------
  // Send a transaction

  const onSendTransaction = async () => {
    console.log(`method name: onSendTransaction`);
    setState({ ...state, creatingTransaction: true });
    console.log('sending a transaction...');

    await state.zkappWorkerClient!.fetchAccount({ publicKey: state.publicKey! });
    await state.zkappWorkerClient!.fetchAccount({ publicKey: state.zkappPublicKey! });

    if (NETWORK === SUPPORTED_NETWORKS.BERKELEY) {
      await state.zkappWorkerClient!.createUpdateTransaction();
    } else if (NETWORK === SUPPORTED_NETWORKS.LOCAL) {
      const localPrivateKey = await state.zkappWorkerClient!.getLocalPrivateKey();
      await state.zkappWorkerClient?.createLocalUpdateTransaction(localPrivateKey);
    }


    console.log('creating proof...');
    await state.zkappWorkerClient!.proveUpdateTransaction();

    console.log('getting Transaction JSON...');
    const transactionJSON = await state.zkappWorkerClient!.getTransactionJSON()
    console.info(`transaction JSON: ${transactionJSON}`);

    console.log('requesting send transaction...');

    if (NETWORK === SUPPORTED_NETWORKS.BERKELEY) {
      const { hash } = await (window as any).mina.sendTransaction({
        transaction: transactionJSON,
        feePayer: {
          fee: 1,
          memo: 'sending-from-frontend',
        },
      });
      console.log(
        'See transaction at https://berkeley.minaexplorer.com/transaction/' + hash
      );
    } else if (NETWORK === SUPPORTED_NETWORKS.LOCAL) {
      const res = await state.zkappWorkerClient?.sendLocalTransaction();
      console.info(`sent local transaction with hash: ${res}`);
    }

    setState({ ...state, creatingTransaction: false });
  }

  // -------------------------------------------------------
  // Refresh the current state

  const onRefreshCurrentNum = async () => {
    console.log('getting zkApp state...');
    await state.zkappWorkerClient!.fetchAccount({ publicKey: state.zkappPublicKey! })
    const currentNum = await state.zkappWorkerClient!.getNum();
    console.log('current state:', currentNum.toString());

    setState({ ...state, currentNum });
  }

  let hasWallet;
  if (state.hasWallet != null && !state.hasWallet) {
    const auroLink = 'https://www.aurowallet.com/';
    const auroLinkElem = <a href={auroLink} target="_blank" rel="noreferrer"> [Link] </a>
    hasWallet = <div> Could not find a wallet. Install Auro wallet here: { auroLinkElem }</div>
  }

  let setupText = state.hasBeenSetup ? 'SnarkyJS Ready' : 'Setting up SnarkyJS...';
  let setup = <div> { setupText } { hasWallet }</div>

  let accountDoesNotExist;
  if (state.hasBeenSetup && !state.accountExists) {
    const faucetLink = "https://faucet.minaprotocol.com/?address=" + state.publicKey!.toBase58();
    accountDoesNotExist = <div>
      Account does not exist. Please visit the faucet to fund this account
      <a href={faucetLink} target="_blank" rel="noreferrer"> [Link] </a>
    </div>
  }

  let mainContent;
  if (state.hasBeenSetup && state.accountExists) {
    mainContent = <div>
      <button onClick={onSendTransaction} disabled={state.creatingTransaction}> Send Transaction </button>
      <div> Current Number in zkApp: { state.currentNum!.toString() } </div>
      <button onClick={onRefreshCurrentNum}> Get Latest State </button>
    </div>
  }

  return <div>
    { setup }
    { accountDoesNotExist }
    { mainContent }
  </div>
}
