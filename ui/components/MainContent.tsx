import * as React from "react";
import { PrivateKey, PublicKey} from "snarkyjs";
import { Button } from '@nextui-org/react';
import ZkappWorkerClient from "../pages/zkappWorkerClient";
import {clearState} from "../utils/datasource";
import { OracleDataSource } from "../utils/OracleDataSource";
import {rootHashToUiInfo, UiInfo} from '../utils/ui-formatting';
import { Balance } from "./AccountInfo";
interface Props {
  workerClient: ZkappWorkerClient;
  zkappPublicKey: PublicKey;
  isLocal: boolean;
  userPrivateKey: PrivateKey;
}

interface State {
  zkAppBalance?: string;
  userBalance?: string;
  awaiting: boolean;
  appState: UiInfo | undefined;
  userState: UiInfo | undefined
}

export class MainContent extends React.Component<Props, State> {
  public constructor(props: Props) {
    super(props);
    this.state = {
      zkAppBalance: undefined,
      userBalance: undefined,
      awaiting: false,
      appState: undefined,
      userState: undefined
    };
  }

  public async componentDidMount() {
    await this.refreshBalances();
    await this.loadContractAndExternalStates();
    const oracleResult = await OracleDataSource.get();
    console.info(
      `logging the oracleResult from MainContent.tsx; here it is: ${JSON.stringify(
        oracleResult
      )}`
    );
  }

  private refreshBalances = async () => {
    const { zkappPublicKey, userPrivateKey } = this.props;
    const [zkAppBalance, userBalance] =
      await this.props.workerClient.loadBalances([
        zkappPublicKey,
        userPrivateKey.toPublicKey(),
      ]);
    this.setState({
      zkAppBalance,
      userBalance,
    });
  };

  private loadContractAndExternalStates = async (e?: any) => {
      this.forceUpdate();
      const {contractRoot, userRoot} = await this.props.workerClient.loadAccountRootHashes(this.props.zkappPublicKey, this.props.userPrivateKey.toPublicKey());
      const appState = await rootHashToUiInfo(contractRoot, this.props.userPrivateKey.toPublicKey());
      const userState = await rootHashToUiInfo(userRoot, this.props.userPrivateKey.toPublicKey());
      console.log(`loadContractAndExternalStates - app state balance: ${appState.merkleValue}`);
      console.log(`loadContractAndExternalStates - local state balance: ${userState.merkleValue}`);
      this.forceUpdate();
      this.setState({appState, userState});
  };

  private handleDeposit = async () => {
    this.setState({ awaiting: true });
    try {
      await this.props.workerClient.deposit(1000, this.props.userPrivateKey);
      await this.refreshBalances();
      await this.loadContractAndExternalStates();
    } catch (err) {
      throw err;
    } finally {
      this.setState({ awaiting: false });
    }
  };

  private handleWithdraw = async (e: any) => {
    this.forceUpdate();
    this.setState({ awaiting: true });

    try {
      await this.props.workerClient.withdraw(this.props.userPrivateKey);
      await this.refreshBalances();
      await this.loadContractAndExternalStates();
    } catch (err) {
      throw err;
    } finally {
      this.setState({ awaiting: false });
    }
  };

  private clearExternalData = async () => {
    await clearState();
  };

  private loadWrapper = async (e: any) => {
    e.stopPropagation();
    await this.loadContractAndExternalStates();
  }

  render() {
    return (
      <div>
        <Button.Group color="primary">
          <Button onClick={this.handleDeposit} disabled={this.state.awaiting}>
            Deposit 1000
          </Button>
          <Button onClick={this.handleWithdraw} disabled={this.state.awaiting}>
            Withdraw Entire balance
          </Button>
        </Button.Group>
          <Button.Group color="secondary">
            <Button onClick={this.refreshBalances}>Refresh balances</Button>
            <Button onClick={this.loadWrapper}>Refresh Merkle States</Button>
          </Button.Group>
        <Button.Group color="warning">
          <Button onClick={this.clearExternalData}>
            DELETE External State (be very careful!)
          </Button>
        </Button.Group>
        {this.state.zkAppBalance ? (
          <Balance
            balance={this.state.zkAppBalance}
            label="ZK App Account balance"
          />
        ) : (
          <div>Loading ZK App Balance...</div>
        )}
        {this.state.userBalance ? (
          <Balance
            balance={this.state.userBalance}
            label="User account balance"
          />
        ) : (
          <div>Loading user account...</div>
        )}
        <h2>App and local state</h2>
        {this.state.appState && <MerkleStateUi
           name={"ZK App State (on-chain)"}
           rootHash={this.state.appState.rootHash}
           publicKey={this.state.appState.publicKey}
           merkleKey={this.state.appState.merkleKey}
           merkleValue={this.state.appState.merkleValue}
        />}
        {this.state.userState && <MerkleStateUi
          name={"Local State (off-chain)"}
          rootHash={this.state.userState.rootHash}
          publicKey={this.state.userState.publicKey}
          merkleKey={this.state.userState.merkleKey}
          merkleValue={this.state.userState.merkleValue}
        /> }
      </div>
    );
  }
}



interface MerkleStateUiProps {
  name: string;
  rootHash: string;
  publicKey: PublicKey;
  merkleKey: string;
  merkleValue?: string;
}
function MerkleStateUi(props: MerkleStateUiProps) {
  let inner = <div>loading...</div>;
  if (props) {
    inner = (
      <div>
        <ul>
          <li>Root Hash: {props.rootHash}</li>
          <li>Public Key: {props.publicKey.toBase58()}</li>
          <li>Merkle Key and Value
            <ul>
              <li>Key: {props.merkleKey}</li>
              <li>Value: {props.merkleValue}</li>
            </ul>
          </li>
        </ul>
      </div>
    )
  }

  return (
    <div>
      <h3>{props.name}</h3>
      {inner}
    </div>
  )
}