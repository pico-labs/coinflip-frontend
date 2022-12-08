import '../styles/globals.css'
import { useEffect, useState } from "react";
import './reactCOIServiceWorker';
import {MainContent} from '../components/MainContent';
import {networkConfig} from '../utils/constants';
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
  userAccountExists: boolean,
  currentNum: Field | null,
  publicKey: PublicKey | null,
  zkappPublicKey: PublicKey | null,
  creatingTransaction: boolean
}

const NETWORK = networkConfig.currentNetwork

export default function App() {
  let [state, setState] = useState<AppState>({
    zkappWorkerClient: null as null | ZkappWorkerClient,
    hasWallet: null as null | boolean,
    hasBeenSetup: false,
    userAccountExists: false,
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
      if (state.hasBeenSetup && !state.userAccountExists) {
        for (;;) {
          console.log('checking if account exists...');
          const res = await state.zkappWorkerClient!.fetchAccount({ publicKey: state.publicKey! })
          const accountExists = res.error == null;
          if (accountExists) {
            break;
          }
          await new Promise((resolve) => setTimeout(resolve, 5000));
        }
        setState({ ...state, userAccountExists: true });
      }
    })();
  }, [state.hasBeenSetup]);

  // -------------------------------------------------------
  // Send a transaction

  let hasWallet;
  if (state.hasWallet != null && !state.hasWallet) {
    const auroLink = 'https://www.aurowallet.com/';
    const auroLinkElem = <a href={auroLink} target="_blank" rel="noreferrer"> [Link] </a>
    hasWallet = <div> Could not find a wallet. Install Auro wallet here: { auroLinkElem }</div>
  }

  let setupText = state.hasBeenSetup ? 'SnarkyJS Ready' : 'Setting up SnarkyJS...';
  let setup = <div> { setupText } { hasWallet }</div>

  let accountDoesNotExist;
  if (state.hasBeenSetup && !state.userAccountExists) {
    const faucetLink = "https://faucet.minaprotocol.com/?address=" + state.publicKey!.toBase58();
    accountDoesNotExist = <div>
      Account does not exist. Please visit the faucet to fund this account
      <a href={faucetLink} target="_blank" rel="noreferrer"> [Link] </a>
    </div>
  }

  return (
    <div>
      { setup }
      { accountDoesNotExist }
      {state.hasBeenSetup && state.userAccountExists && state.zkappWorkerClient && state.zkappPublicKey && state.publicKey
        && <MainContent
          workerClient={state.zkappWorkerClient}
          onUpdateNumCallback={() => {}}
          zkappPublicKey={state.zkappPublicKey}
          userPublicKey={state.publicKey}
        />
      }
      <footer>
        <h3>Your currently configured network is {NETWORK}</h3>
      </footer>
    </div>
  );
}
