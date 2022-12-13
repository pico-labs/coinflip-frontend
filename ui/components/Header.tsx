import * as styles from './Header.module.css';
import { Text } from '@nextui-org/react';
export function Header() {
  return (
    <div
      // TODO: JB
      // @ts-ignore
      className={styles['container']}
    >
      <Text h2>Welcome to Mina CoinFlip</Text>
    </div>
  );
}