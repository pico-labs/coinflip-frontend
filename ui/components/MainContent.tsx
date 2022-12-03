import * as React from 'react';
import {Field, PublicKey} from 'snarkyjs';
import ZkappWorkerClient from '../pages/zkappWorkerClient';
interface Props {
  workerClient: ZkappWorkerClient;
  zkappPublicKey: PublicKey
  onUpdateNumCallback: (num: Field) => void;
  creatingTransaction: boolean;
  currentNum: Field;
  onSendTransaction: () => void;
}
export class MainContent extends React.Component<Props, {}> {
  public constructor(props: Props) {
    super(props);
    console.log(`method name: constructor`);
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
      </div>
    );
  }
}