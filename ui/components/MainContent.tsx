import { networkConfig } from "../utils/constants";
import { makeAccountUrl } from "../utils/minascan";
import * as styles from "./MainContent.module.css";
import * as React from "react";
import { PrivateKey, PublicKey } from "snarkyjs";
import {
  Button,
  Card,
  Loading,
  Spacer,
  StyledLink,
  Text,
} from "@nextui-org/react";
import ZkappWorkerClient from "../pages/zkappWorkerClient";
import { clearState } from "../utils/datasource";
import { OracleDataSource } from "../utils/OracleDataSource";
import { rootHashToUiInfo, UiInfo } from "../utils/ui-formatting";
import { Balance } from "./Balance";
interface Props {
  workerClient: ZkappWorkerClient | null;
  zkappPublicKey: PublicKey | null;
  isLocal: boolean;
  userPrivateKey?: PrivateKey;
  stateIsSetup: boolean;
}

interface SetupProps extends Props {
  workerClient: ZkappWorkerClient;
  zkappPublicKey: PublicKey;
  userPrivateKey: PrivateKey;
  stateIsSetup: true;
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
      awaitingInitialLoad: true,
    };
  }

  async componentDidUpdate(prevProps: Props, _prevState: State) {
    if (this.props.stateIsSetup && !prevProps.stateIsSetup) {
      await this.refreshBalances();
      await this.loadContractAndExternalStates();
      this.updateAwaitingInitialLoad();
    }
  }

  private updateAwaitingInitialLoad() {
    this.setState({ awaitingInitialLoad: false });
  }

  private refreshBalances = async () => {
    if (canBeRun(this.props)) {
      assertStateIsSetup(this.props);

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
    }
  };

  private loadContractAndExternalStates = async (e?: any) => {
    this.forceUpdate();
    if (canBeRun(this.props)) {
      assertStateIsSetup(this.props);

      const { contractRoot, userRoot } =
        await this.props.workerClient.loadAccountRootHashes(
          this.props.zkappPublicKey,
          this.props.userPrivateKey.toPublicKey()
        );
      const appState = await rootHashToUiInfo(
        contractRoot,
        this.props.userPrivateKey.toPublicKey()
      );
      const userState = await rootHashToUiInfo(
        userRoot,
        this.props.userPrivateKey.toPublicKey()
      );
      console.log(
        `loadContractAndExternalStates - app state balance: ${appState.merkleValue}`
      );
      console.log(
        `loadContractAndExternalStates - local state balance: ${userState.merkleValue}`
      );
      this.forceUpdate();
      this.setState({ appState, userState });
    }
  };

  private handleDeposit = async () => {
    this.setState({ awaiting: true });

    if (canBeRun(this.props)) {
      assertStateIsSetup(this.props);
      try {
        await this.props.workerClient.deposit(1000, this.props.userPrivateKey);
        await this.refreshBalances();
        await this.loadContractAndExternalStates();
      } catch (err) {
        throw err;
      } finally {
        this.setState({ awaiting: false });
      }
    }
  };

  private handleWithdraw = async (e: any) => {
    this.forceUpdate();
    this.setState({ awaiting: true });

    if (canBeRun(this.props)) {
      assertStateIsSetup(this.props);
      try {
        await this.props.workerClient.withdraw(this.props.userPrivateKey);
        await this.refreshBalances();
        await this.loadContractAndExternalStates();
      } catch (err) {
        throw err;
      } finally {
        this.setState({ awaiting: false });
      }
    }
  };

  private handleFlipCoin = async () => {
    console.log(`method name: handleFlipCoin`);
    if (canBeRun(this.props)) {
      assertStateIsSetup(this.props);

      const { userPrivateKey, zkappPublicKey } = this.props;
      try {
        const oracleResult = await OracleDataSource.get(
          zkappPublicKey.toBase58()
        );
        console.info(
          `logging the oracleResult from MainContent.tsx; here it is: ${JSON.stringify(
            oracleResult
          )}`
        );
        const resultFromFlipCoin = await this.props.workerClient.flipCoin(
          userPrivateKey,
          oracleResult!,
          PrivateKey.fromBase58(process.env.EXECUTOR_PRIVATE_KEY!)
        );
        console.info(
          "result from flip coin: " + JSON.stringify(resultFromFlipCoin)
        );
      } catch (err) {
        throw err;
      }
    }
  };

  private clearExternalData = async () => {
    await clearState();
  };

  private loadWrapper = async (e: any) => {
    console.log(e);
    e?.stopPropagation && e?.stopPropagation();

    await this.loadContractAndExternalStates();
  };

  render() {
    const buttonsAreLoading = !this.props.stateIsSetup;
    const { awaiting } = this.state;
    return (
      <div>
        <div
          // @ts-ignore
          className={styles["buttons-container"]}
        >
          <Button.Group color="success" title={"Flip the coin"} ghost>
            <LoadableButton
              disabled={awaiting}
              onClick={this.handleFlipCoin}
              text={"Flip Coin"}
              loading={buttonsAreLoading || awaiting}
            />
          </Button.Group>
          <Button.Group color="primary" ghost>
            <LoadableButton
              onClick={this.handleDeposit}
              disabled={awaiting}
              text={"Deposit 0.000001 Mina"}
              loading={buttonsAreLoading || awaiting}
            />
            <LoadableButton
              onClick={this.handleWithdraw}
              disabled={awaiting}
              text={"Withdraw collateral + winnings"}
              loading={buttonsAreLoading || awaiting}
            />
          </Button.Group>
          <Button.Group color="secondary" ghost>
            <LoadableButton
              onClick={this.refreshBalances}
              disabled={this.state.awaiting}
              text={"Refresh states and balances"}
              loading={buttonsAreLoading}
            />
            <LoadableButton
              onClick={this.loadWrapper}
              text={"Refresh Merkle States"}
              disabled={this.state.awaiting}
              loading={buttonsAreLoading}
            />
          </Button.Group>
          <Button.Group color="warning" ghost>
            <LoadableButton
              onClick={this.clearExternalData}
              disabled={this.state.awaiting}
              text={"DELETE External State (be very careful!)"}
              loading={buttonsAreLoading}
            />
          </Button.Group>
        </div>
        <Spacer />
        <Text h3>Mina Account Balances</Text>
        {this.state.zkAppBalance ? (
          <Balance
            balance={this.state.zkAppBalance}
            label="ZK App Account balance"
          />
        ) : (
          <div>
            Loading ZK App Balance...
            <Loading size={"md"} />
          </div>
        )}
        <Spacer />
        {this.state.userBalance ? (
          <Balance
            balance={this.state.userBalance}
            label="User account balance"
          />
        ) : (
          <div>
            Loading user account...
            <Loading size={"md"} />
          </div>
        )}
        <Spacer />
        <Text h3>ZK App (on-chain) and Local (off-chain) states</Text>
        <MerkleStateUi
          name={"ZK App State (on-chain)"}
          rootHash={this.state.appState?.rootHash}
          publicKey={this.state.appState?.publicKey}
          merkleKey={this.state.appState?.merkleKey}
          merkleValue={this.state.appState?.merkleValue}
          rightSideHeaderContent={
            <StyledLink
              href={makeAccountUrl(
                networkConfig.BERKELEY.coinflipContract.publicKey
              )}
            >
              Check out the contract on minascan.io
            </StyledLink>
          }
        />
        <Spacer />
        <MerkleStateUi
          name={"Local State (off-chain)"}
          rootHash={this.state.userState?.rootHash}
          publicKey={this.state.userState?.publicKey}
          merkleKey={this.state.userState?.merkleKey}
          merkleValue={this.state.userState?.merkleValue}
          loading={buttonsAreLoading}
        />
      </div>
    );
  }
}

interface MerkleStateUiProps {
  name: string;
  rootHash?: string;
  publicKey?: PublicKey;
  merkleKey?: string;
  // this one can actually be null on fetch; the others can only be null when loading.
  merkleValue?: string;
  loading?: boolean;
  rightSideHeaderContent?: JSX.Element;
}
function MerkleStateUi(props: MerkleStateUiProps) {
  let inner;
  const loading = props.loading || !props.rootHash;
  if (!loading) {
    inner = (
      <Card>
        <Card.Header>
          <div
            // @ts-ignore
            className={styles["card-header-wrapper"]}
          >
            <div>
              <strong>{props.name}</strong>
            </div>
            <div>{props.rightSideHeaderContent}</div>
          </div>
        </Card.Header>
        <Card.Body>
          <div>Merkle Root Hash: {props.rootHash}</div>
          <div>Merkle Key: {props.merkleKey}</div>
          <div>Merkle Value: {props.merkleValue}</div>
        </Card.Body>
        <Card.Footer>
          <div>Public Key: {props.publicKey?.toBase58()}</div>
        </Card.Footer>
      </Card>
    );
  } else {
    inner = (
      <Card>
        <Card.Header>
          <div
            // @ts-ignore
            className={styles["card-header-wrapper"]}
          >
            <div>
              <strong>{props.name}</strong>
            </div>
            <div>{props.rightSideHeaderContent}</div>
          </div>
        </Card.Header>
        <Card.Body>
          <Loading size={"lg"} />
        </Card.Body>
        <Card.Footer />
      </Card>
    );
  }

  return <div>{inner}</div>;
}

function canBeRun(props: Props): boolean {
  const { stateIsSetup, zkappPublicKey, userPrivateKey, workerClient } = props;
  return stateIsSetup && !!zkappPublicKey && !!userPrivateKey && !!workerClient;
}

function assertStateIsSetup(value: unknown): asserts value is SetupProps {
  const castValue = value as SetupProps;
  const anyAreInvalid = [
    castValue.stateIsSetup,
    castValue.userPrivateKey,
    castValue.workerClient,
    castValue.zkappPublicKey,
  ].some((value) => value === null || value === undefined);
  if (anyAreInvalid) {
    throw "invalid setup state!";
  }
}

interface LoadableButtonProps {
  disabled: boolean;
  text: string;
  onClick: (e?: any) => void;
  loading: boolean;
}
function LoadableButton(props: LoadableButtonProps): JSX.Element {
  const { loading, text, disabled } = props;
  return (
    <Button disabled={disabled || loading} onClick={props.onClick}>
      {loading ? <Loading size={"md"} /> : text}
    </Button>
  );
}
