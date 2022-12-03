import {Mina, PublicKey} from 'snarkyjs';
import ZkappWorkerClient from '../pages/zkappWorkerClient';

interface BalanceProps {
  publicKey: PublicKey
  label: string;
  worker: ZkappWorkerClient
}

export function Balance(props: BalanceProps) {
  console.log(props);
  // const result = await props.worker.fetchAccount({publicKey: props.publicKey});
  // console.info(result);

  // const balance = account ? account.balance.toString() : `Unable to fetch balance for account`;
  // const header = account ? `Balance for account: ${props.label} with key: ${props.publicKey}` : `Error fetching account with key: ${props.publicKey}`;
  return (
    <div>
      Foo
      {/*<h3>{props.label}</h3>*/}
      {/*<div>{result.account?.balance.toString()}</div>*/}
    </div>
  );
}