import * as React from 'react';
import {Field, PublicKey} from 'snarkyjs';
import ZkappWorkerClient from '../pages/zkappWorkerClient';
import { Balance} from './AccountInfo';
interface Props {
  workerClient: ZkappWorkerClient;
  zkappPublicKey: PublicKey
  onUpdateNumCallback: (num: Field) => void;
  creatingTransaction: boolean;
  currentNum: Field;
  userPublicKey: PublicKey
  onSendTransaction: () => void;
}

interface State {
  zkAppBalance?: string;
  userBalance?: string;
}

export class MainContent extends React.Component<Props, State> {
  public constructor(props: Props) {
    super(props);
    this.state = {
      zkAppBalance: undefined,
      userBalance: undefined
    }
  }

  public async componentDidMount() {
    const {zkappPublicKey, userPublicKey} = this.props;
    const [zkAppBalance, userBalance] = await this.props.workerClient.loadBalances([zkappPublicKey, userPublicKey])
    this.setState({
      zkAppBalance,
      userBalance
    });
  }

  private onRefreshCurrentNum = async () => {
    console.log('getting zkApp state...');
    await this.props.workerClient.fetchAccount({ publicKey: this.props.zkappPublicKey })
    const currentNum = await this.props.workerClient.getNum();
    console.log('current state:', currentNum.toString());
    this.props.onUpdateNumCallback(currentNum);
  }

  private onSendTransaction = async () => {
    this.props.onSendTransaction();
  }

  render() {
    const {creatingTransaction, currentNum} = this.props;
    return (
      <div>
        <button onClick={this.onSendTransaction} disabled={creatingTransaction}> Send Transaction </button>
        <div> Current Number in zkApp: { currentNum.toString() } </div>
        <button onClick={this.onRefreshCurrentNum}> Get Latest State </button>
        {this.state.zkAppBalance ?
          <Balance balance={this.state.zkAppBalance} label="ZK App Account balance"/> :
          <div>Loading ZK App Balance...</div>
        }
        {this.state.userBalance ?
          <Balance balance={this.state.userBalance} label="User account balance"/> :
          <div>Loading user account...</div>
        }
      </div>
    );
  }
}