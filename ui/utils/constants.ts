const networkConfig = {
  currentNetwork: process.env.APP_NETWORK,
  BERKELEY: {
    coinflipContract: {
      publicKey: 'B62qiTeKV99ugy2JpAV1wGJ7cPGaUBBohH8MPjjGCVFdFexVmVyARHb',
      datastoreKey: 'berkeley-state',
    },
    oracleUrl: undefined,
  },
  LOCAL: {
    coinflipContract: {
      publicKey: undefined,
      datastoreKey: 'local-state',
    },
    oracleUrl: 'http://localhost:3030/randomNumber'
  }
}

const SUPPORTED_NETWORKS = {
  BERKELEY: 'BERKELEY',
  LOCAL: 'LOCAL'
}

export { networkConfig, SUPPORTED_NETWORKS };