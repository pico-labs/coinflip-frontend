import {root} from 'postcss';
import * as React from "react";
import {fetchAccount, Field, Mina, PrivateKey, PublicKey} from "snarkyjs";
import ZkappWorkerClient from "../pages/zkappWorkerClient";
import {networkConfig} from '../utils/constants';
import {
  clearState, deserializeMap,
  ExternalMerkleState,
  getMerkleValuesExternally, serializeMap,
} from "../utils/datasource";
import { OracleDataSource } from "../utils/OracleDataSource";
import { Balance } from "./AccountInfo";
import { FormattedExternalState } from "./FormattedExternalState";
interface Props {
  workerClient: ZkappWorkerClient;
  zkappPublicKey: PublicKey;
  isLocal: boolean;
  userPrivateKey: PrivateKey;
}

interface State {
  zkAppBalance?: string;
  userBalance?: string;
  awaitingDeposit: boolean;
  awaitingWithdraw: boolean;
  externalState: ExternalMerkleState | null;
}

export class MainContent extends React.Component<Props, State> {
  public constructor(props: Props) {
    super(props);
    this.state = {
      zkAppBalance: undefined,
      userBalance: undefined,
      awaitingDeposit: false,
      awaitingWithdraw: false,
      externalState: null,
    };
  }

  public async componentDidMount() {
    this.refreshBalances();
    this.loadExternalBalances();
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

  private loadExternalBalances = async () => {
    // const rootHash = await this.props.workerClient.getStateRootHash();
    // const [merkleMap, setOfFields] = await getMerkleValuesExternally(rootHash);
    // const res = await fetchAccount({publicKey: networkConfig.BERKELEY.coinflipContract.publicKey});
    // console.log(res);
    // console.info(res.account?.appState);
    // const externalState = deserializeMap(merkleMap, setOfFields);
    // const result = serializeMap(externalState)
    // console.info(result);
    // console.info(externalState);
    // this.props.userPrivateKey.toPublicKey().toBase58()

    // TODO: JB -- This is where we have to load/resolve balances.
    // TODO: UNMERGED
    // coby pub key
    // console.debug('logging pub keys')
    // console.info(balanceForKey(externalState, PublicKey.fromBase58('B62qkJ4kUg4qkevbJwVZUpKgTre9dPai1i39Rf8BmpNe8w4yzNPNJCb')));
    // console.info(balanceForKey(externalState, this.props.userPrivateKey.toPublicKey()));
    // this.setState({ externalState });
  };

  private handleDeposit = async () => {
    console.log(`method name: handleDeposit`);
    this.setState({ awaitingDeposit: true });

    try {
      let Berkeley = Mina.Network(
        'https://proxy.berkeley.minaexplorer.com/graphql'
      );
      Mina.setActiveInstance(Berkeley);
      await this.props.workerClient.deposit(1000, this.props.userPrivateKey);
      this.refreshBalances();
      this.loadExternalBalances();
    } catch (err) {
      throw err;
    } finally {
      this.setState({ awaitingDeposit: false });
    }
  };

  private handleWithdraw = async () => {
    console.log(`method name: handleWithdraw`);
    const { userPrivateKey } = this.props;
    this.setState({ awaitingWithdraw: true });

    try {
      // TODO: JB - this does not support multiple balance changes.
      await this.props.workerClient.withdraw(userPrivateKey);
      this.refreshBalances();
    } catch (err) {
      throw err;
    } finally {
      this.setState({ awaitingWithdraw: false });
    }
  };

  private clearExternalData = async () => {
    await clearState();
  };

  render() {
    const { awaitingDeposit, awaitingWithdraw } = this.state;
    return (
      <div>
        <hr />
        <button onClick={this.refreshBalances}>Refresh balances</button>
        <button onClick={this.handleDeposit} disabled={awaitingDeposit}>
          Deposit 1000
        </button>
        <button onClick={this.handleWithdraw} disabled={awaitingWithdraw}>
          Withdraw Entire balance
        </button>
        <button onClick={this.loadExternalBalances}>
          Refresh External State
        </button>
        <button onClick={this.clearExternalData}>
          DELETE External State (be very careful!)
        </button>
        <hr />
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
        <hr />
        <h2>External state balances</h2>
        <FormattedExternalState values={this.state.externalState} />
      </div>
    );
  }
}
