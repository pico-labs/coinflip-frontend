const networkConfig = {
  currentNetwork: process.env.APP_NETWORK,
  BERKELEY: {
    coinflipContract: {
      publicKey: 'B62qjroK2cjbPeLoPnVaX6EoHPEMcWP7pfhuG4rVXgzA9WRiC7tKGGZ',
      datastoreKey: 'berkeley-state',
    },
    oracleUrl:
      "https://randomness-oracle-ah5yo4vyg-pico-labs.vercel.app/api/randomNumber",
  },
  LOCAL: {
    coinflipContract: {
      publicKey: undefined,
      datastoreKey: "local-state",
    },
    oracleUrl: "http://localhost:3030/api/randomNumber",
  },
};

const SUPPORTED_NETWORKS = {
  BERKELEY: "BERKELEY",
  LOCAL: "LOCAL",
};

export { networkConfig, SUPPORTED_NETWORKS };
