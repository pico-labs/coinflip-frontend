import "../styles/globals.css";
import * as React from "react";
import { useEffect, useState } from "react";
import "./reactCOIServiceWorker";
import { MainContent } from "../components/MainContent";
import { networkConfig } from "../utils/constants";
import { setupNetwork } from "../utils/setup";

import ZkappWorkerClient from "./zkappWorkerClient";

import { PublicKey, Field, PrivateKey } from "snarkyjs";

export interface AppState {
  zkappWorkerClient: null | ZkappWorkerClient;
  hasWallet: null | boolean;
  hasBeenSetup: boolean;
  userAccountExists: boolean;
  currentNum: Field | null;
  publicKey: PublicKey | null;
  zkappPublicKey: PublicKey | null;
  creatingTransaction: boolean;
  userInputPrivateKey?: PrivateKey;
}

const NETWORK = networkConfig.currentNetwork;

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
    userInputPrivateKey: undefined,
  });

  useEffect(() => {
    (async () => {
      const { hasBeenSetup, userInputPrivateKey } = state;
      if (!hasBeenSetup && userInputPrivateKey) {
        const zkappWorkerClient = new ZkappWorkerClient();

        console.log("Loading SnarkyJS...");
        await zkappWorkerClient.loadSnarkyJS();

        if (NETWORK === "BERKELEY" || NETWORK === "LOCAL") {
          const setupState = await setupNetwork(
            NETWORK,
            zkappWorkerClient,
            state
          );
          setState({ ...setupState });
        } else {
          throw `Network: ${NETWORK} not supported`;
        }
      }
    })();
  }, [state.userInputPrivateKey]);

  useEffect(() => {
    (async () => {
      if (state.hasBeenSetup && !state.userAccountExists) {
        for (;;) {
          console.log("checking if account exists...");
          const res = await state.zkappWorkerClient!.fetchAccount({
            publicKey: state.publicKey!,
          });
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

  function handleInputValueChange(e: React.ChangeEvent<HTMLInputElement>) {
    const privateKey = PrivateKey.fromBase58(e.currentTarget.value);
    const publicKey = privateKey.toPublicKey();
    setState({ ...state, userInputPrivateKey: privateKey, publicKey });
  }

  // -------------------------------------------------------
  // Send a transaction

  let setupText = state.hasBeenSetup
    ? "SnarkyJS Ready"
    : state.userInputPrivateKey
    ? "Setting up SnarkyJS..."
    : "Please enter your private key to proceed";
  let setup = (
    <div>
      {" "}
      {setupText}
    </div>
  );

  const isLocal = NETWORK !== "BERKELEY";
  const inputPrivateKeyControls = (
    <div>
      <label>Enter private key</label>
      <input onChange={handleInputValueChange} />
    </div>
  );

  return (
    <div>
      <WithPadding>
        {inputPrivateKeyControls}
      </WithPadding>
      <WithPadding>
        {setup}
      </WithPadding>
      <WithPadding>
      {state.hasBeenSetup &&
        state.userAccountExists &&
        state.zkappWorkerClient &&
        state.zkappPublicKey &&
        state.userInputPrivateKey && (
          <MainContent
            workerClient={state.zkappWorkerClient}
            zkappPublicKey={state.zkappPublicKey}
            isLocal={isLocal}
            userPrivateKey={state.userInputPrivateKey}
          />
        )}
      </WithPadding>
      <footer>
        <WithPadding>
          <h3>Your currently configured network is {NETWORK}</h3>
        </WithPadding>
      </footer>
    </div>
  );
}

type JsFalsey = null | undefined | false | 0 | '';
function WithPadding(props: {children: JSX.Element | Array<JSX.Element> | JsFalsey}) {
  return (
    <div style={{padding: '16px'}}>
      {props.children}
    </div>
  )
}