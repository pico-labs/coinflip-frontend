import {ExternalMerkleState} from '../utils/datasource';

interface FormattedExternalStateProps {
  values: ExternalMerkleState | null;
}
export function FormattedExternalState(props: FormattedExternalStateProps) {
  if (!props.values) {
    return <div>No value set yet for external state...try depositing?</div>
  }

  const entries = Object.entries(props.values);
  return (
    <div>
      {
        entries.map(tuple => {
          return (
            <div key={tuple[0]}>
              <h4>Address: {tuple[0]}</h4>
              <p>Balance: {tuple[1].balance}</p>
            </div>
          )
        })
      }
    </div>
  )
}