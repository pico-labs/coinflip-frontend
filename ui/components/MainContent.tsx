import * as styles from './MainContent.module.css'
import * as React from "react";
import { PrivateKey, PublicKey} from "snarkyjs";
import {Button, Card, Loading, Spacer, Text} from '@nextui-org/react';
import ZkappWorkerClient from "../pages/zkappWorkerClient";
import {clearState} from "../utils/datasource";
import { OracleDataSource } from "../utils/OracleDataSource";
import {rootHashToUiInfo, UiInfo} from '../utils/ui-formatting';
import { Balance } from "./Balance";
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
  userState: UiInfo | undefined;
  awaitingInitialLoad: boolean;
}

export class MainContent extends React.Component<Props, State> {
  public constructor(props: Props) {
    super(props);
    this.state = {
      zkAppBalance: undefined,
      userBalance: undefined,
      awaiting: false,
      appState: undefined,
      userState: undefined,
      awaitingInitialLoad: true
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
    this.updateAwaitingInitialLoad();
  }

  private updateAwaitingInitialLoad() {
    this.setState({awaitingInitialLoad: false});
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
    const {awaitingInitialLoad} = this.state;
    if (awaitingInitialLoad) {
      return (
        <div>
          <Loading size='lg'/>
        </div>
      );
    }

    return (
      <div>


        <div
          // @ts-ignore
          className={styles['buttons-container']}
        >
          <Button.Group color="success" title={"Flip the coin"} ghost>
            <Button disabled={this.state.awaiting}>Flip Heads</Button>
            <Button disabled={this.state.awaiting}>Flip Tails</Button>
          </Button.Group>
          <Button.Group color="primary" ghost>
            <Button onClick={this.handleDeposit} disabled={this.state.awaiting}>
              Deposit 1000
            </Button>
            <Button onClick={this.handleWithdraw} disabled={this.state.awaiting}>
              Withdraw Entire balance
            </Button>
          </Button.Group>
            <Button.Group color="secondary" ghost>
              <Button onClick={this.refreshBalances}>Refresh balances</Button>
              <Button onClick={this.loadWrapper}>Refresh Merkle States</Button>
            </Button.Group>
          <Button.Group color="warning" ghost>
            <Button onClick={this.clearExternalData} disabled={this.state.awaiting}>
              DELETE External State (be very careful!)
            </Button>
          </Button.Group>
        </div>
        <Spacer/>
        <Text h3>Account Balances</Text>
        {this.state.zkAppBalance ? (
          <Balance
            balance={this.state.zkAppBalance}
            label="ZK App Account balance"
          />
        ) : (
          <div>Loading ZK App Balance...</div>
        )}
        <Spacer/>
        {this.state.userBalance ? (
          <Balance
            balance={this.state.userBalance}
            label="User account balance"
          />
        ) : (
          <div>Loading user account...</div>
        )}
        <Spacer/>
        <Text h3>ZK App (on-chain) and Local (off-chain) states</Text>
        {this.state.appState && <MerkleStateUi
           name={"ZK App State (on-chain)"}
           rootHash={this.state.appState.rootHash}
           publicKey={this.state.appState.publicKey}
           merkleKey={this.state.appState.merkleKey}
           merkleValue={this.state.appState.merkleValue}
        />}
        <Spacer/>
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
  let inner = <Loading size={'lg'}/>
  if (props) {
    inner = (
      <Card>
        <Card.Header><strong>{props.name}</strong></Card.Header>
        <Card.Body>
          <div>Merkle Root Hash: {props.rootHash}</div>
          <div>Merkle Key: {props.merkleKey}</div>
          <div>Merkle Value: {props.merkleValue}</div>
        </Card.Body>
        <Card.Footer>
          <div>Public Key: {props.publicKey.toBase58()}</div>
        </Card.Footer>
      </Card>
    )
  }

  return (
    <div>
      {inner}
    </div>
  )
}