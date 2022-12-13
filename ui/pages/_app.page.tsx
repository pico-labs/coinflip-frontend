import "../styles/globals.css";
import {Footer} from '../components/Footer';
import {Header} from '../components/Header';
import * as styles from '../styles/Home.module.css'
import {Input, Loading, NextUIProvider, Text} from '@nextui-org/react';
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
    zkappPublicKey: null as null | PublicKey,
    creatingTransaction: false,
    userInputPrivateKey: undefined,
  });

  useEffect(() => {
    (async () => {
      const { hasBeenSetup, userInputPrivateKey } = state;
      const shouldRun =
        (!hasBeenSetup && userInputPrivateKey) ||
        (NETWORK === "LOCAL" && !hasBeenSetup);
      if (shouldRun) {
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
            publicKey: state.userInputPrivateKey!.toPublicKey(),
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
    setState({ ...state, userInputPrivateKey: privateKey });
  }

  // -------------------------------------------------------
  // Send a transaction





  let setup = (
    <div>
      {state.hasBeenSetup && <Text h3>SnarkyJS is ready!</Text>}
      {!state.hasBeenSetup && !state.userInputPrivateKey &&
        <div>
          <Text h3>Please enter your private key below to load SnarkyJS</Text>
        </div>
      }
      {!state.hasBeenSetup && state.userInputPrivateKey &&
        <div>
          <Text h3>Loading SnarkyJS...</Text>
          <Loading size={'lg'}/>
        </div>
        }
      {}
    </div>
  );

  const isLocal = NETWORK !== "BERKELEY";
  const inputPrivateKeyControls = (
    <div>
      <Input
        label="Private Key 58"
        placeholder={`e.g. Zap2139ASkmcxsA...`}
        // TODO: JB - Sigh, the types seem to be coming in wrong.
        // @ts-ignore
        onChange={handleInputValueChange}
      />
    </div>
  );

  return (
    <NextUIProvider>


    <Header/>
    {/*  @ts-ignore */}
    <div className={styles['container']}>
      <WithPadding>{setup}</WithPadding>
      <WithPadding>{inputPrivateKeyControls}</WithPadding>
      <WithPadding>
        {state.hasBeenSetup &&
          state.userAccountExists &&
          state.zkappWorkerClient &&
          state.zkappPublicKey &&
          state.userInputPrivateKey &&
          (
            <MainContent
              workerClient={state.zkappWorkerClient}
              zkappPublicKey={state.zkappPublicKey}
              isLocal={isLocal}
              userPrivateKey={state.userInputPrivateKey}
            />
          )}
      </WithPadding>
    </div>
    <Footer/>
    </NextUIProvider>
  );
}

type JsFalsey = null | undefined | false | 0 | "";
function WithPadding(props: {
  children: JSX.Element | Array<JSX.Element> | JsFalsey;
}) {
  return <div style={{ padding: "16px" }}>{props.children}</div>;
}
