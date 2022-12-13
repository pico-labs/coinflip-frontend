import { Text } from "@nextui-org/react";
import * as styles from "./Footer.module.css";

export function Footer() {
  return (
    <footer
      // @ts-ignore
      className={styles["container"]}
    >
      <Text h4>Brought to you by Pico Labs</Text>
    </footer>
  );
}
