
const networkConfig = {
  Berkeley: {
    coinflipContract: {
      publicKey: 'B62qjAwNeTb4YqpaNwrLmCporHJ2jRiq5xYuVdGpmwq94cke2FQtVQG',
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