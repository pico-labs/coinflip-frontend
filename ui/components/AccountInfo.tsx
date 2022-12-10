interface BalanceProps {
  label: string;
  balance: string;
}
export function Balance(props: BalanceProps) {
  const balance = props.balance;
  return (
    <div>
      <h3>{props.label}</h3>
      <p>{balance}</p>
    </div>
  );
}
