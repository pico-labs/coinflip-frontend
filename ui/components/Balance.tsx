import {Card} from '@nextui-org/react';
interface BalanceProps {
  label: string;
  balance: string;
}
export function Balance(props: BalanceProps) {
  const {balance, label} = props;
  return (
    <Card>
      <Card.Header>{label}</Card.Header>
      <Card.Body>Balance: {balance}</Card.Body>
    </Card>
  );
}
