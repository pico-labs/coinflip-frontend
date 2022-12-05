
const networkConfig = {
  Berkeley: {
    addContract: {
      publicKey: 'B62qrDe16LotjQhPRMwG12xZ8Yf5ES8ehNzZ25toJV28tE9FmeGq23A'
    },
    coinflipContract: {
      publicKey: undefined
    }
  }
}

const SUPPORTED_NETWORKS = {
  BERKELEY: 'BERKELEY',
  LOCAL: 'LOCAL'
}

export { networkConfig, SUPPORTED_NETWORKS };