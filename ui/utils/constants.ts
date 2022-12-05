
const networkConfig = {
  Berkeley: {
    coinflipContract: {
      publicKey: 'B62qiTeKV99ugy2JpAV1wGJ7cPGaUBBohH8MPjjGCVFdFexVmVyARHb',
      datastoreKey: 'berkeley-state',
    }
  },
  Local: {
    coinflipContract: {
      datastoreKey: 'local-state'
    }
  }
}

const SUPPORTED_NETWORKS = {
  BERKELEY: 'BERKELEY',
  LOCAL: 'LOCAL'
}

export { networkConfig, SUPPORTED_NETWORKS };