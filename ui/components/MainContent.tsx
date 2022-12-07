import * as React from 'react';
import {Field, PublicKey} from 'snarkyjs';
import ZkappWorkerClient from '../pages/zkappWorkerClient';
import {clearState, ExternalMerkleState, getMerkleValuesExternally} from '../utils/datasource';
import { Balance} from './AccountInfo';
import {FormattedExternalState} from './FormattedExternalState';
interface Props {
  workerClient: ZkappWorkerClient;
  zkappPublicKey: PublicKey
  onUpdateNumCallback: (num: Field) => void;
  userPublicKey: PublicKey
}

interface State {
  zkAppBalance?: string;
  userBalance?: string;
  awaitingDeposit: boolean;
  awaitingWithdraw: boolean;
  externalState: ExternalMerkleState | null
}

export class MainContent extends React.Component<Props, State> {
  public constructor(props: Props) {
    super(props);
    this.state = {
      zkAppBalance: undefined,
      userBalance: undefined,
      awaitingDeposit: false,
      awaitingWithdraw: false,
      externalState: null
    }
  }

  public componentDidMount() {
    this.refreshBalances();
    this.loadExternalBalances();
  }

  private refreshBalances = async () => {
    const {zkappPublicKey, userPublicKey} = this.props;
    const [zkAppBalance, userBalance] = await this.props.workerClient.loadBalances([zkappPublicKey, userPublicKey])
    this.setState({
      zkAppBalance,
      userBalance
    });
  }

  private loadExternalBalances = async () => {
    const externalState = await getMerkleValuesExternally();
    this.setState({externalState})
  }

  private handleDeposit = async () => {
    console.log(`method name: handleDeposit`);
    const localPrivateKey = await this.props.workerClient.getLocalPrivateKey();
    this.setState({awaitingDeposit: true});

    try {
      // TODO: JB - this does not support multiple balance changes.
      await this.props.workerClient.deposit(1000, localPrivateKey);
      this.refreshBalances()
    } catch (err) {
      throw err;
    } finally {
      this.setState({awaitingDeposit: false});
    }
  }

  private handleWithdraw = async () => {
    console.log(`method name: handleWithdraw`);
    const userPrivateKey = await this.props.workerClient.getLocalPrivateKey();
    this.setState({awaitingWithdraw: true});

    try {
      // TODO: JB - this does not support multiple balance changes.
      await this.props.workerClient.withdraw(userPrivateKey);
      this.refreshBalances()
    } catch (err) {
      throw err;
    } finally {
      this.setState({awaitingWithdraw: false});
    }
  }

  private clearExternalData = async () => {
    await clearState();
  }

  render() {
    const {awaitingDeposit, awaitingWithdraw} = this.state
    return (
      <div>
        <hr/>
        <button onClick={this.refreshBalances}>Refresh balances</button>
        <button onClick={this.handleDeposit} disabled={awaitingDeposit}>Deposit 1000</button>
        <button onClick={this.handleWithdraw} disabled={awaitingWithdraw}>Withdraw Entire balance</button>
        <button onClick={this.loadExternalBalances}>Refresh External State</button>
        <button onClick={this.clearExternalData}>DELETE External State (be very careful!)</button>
        {this.state.zkAppBalance ?
          <Balance balance={this.state.zkAppBalance} label="ZK App Account balance"/> :
          <div>Loading ZK App Balance...</div>
        }
        {this.state.userBalance ?
          <Balance balance={this.state.userBalance} label="User account balance"/> :
          <div>Loading user account...</div>
        }
        <FormattedExternalState values={this.state.externalState}/>
      </div>
    );
  }
}