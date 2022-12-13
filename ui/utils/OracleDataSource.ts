export type OracleResult = {
  publicKey: {
    x: string;
    y: string;
  };
  cipherText: string[];
  signature: string;
};

export class OracleDataSource {
  static async get(executorAddress: string): Promise<OracleResult | null> {
    console.log(`Oracle: ${process.env.RANDOMNESS_ORACLE_URL}`);
    try {
      const url = `${process.env.RANDOMNESS_ORACLE_URL}/api/randomNumber/${executorAddress}`;
      const result = await fetch(url);
      const json = await result.json();
      json.cipherText = json.cipherText.split(",");
      return json;
    } catch (err) {
      console.error(err);
      return null;
    }
  }
}
