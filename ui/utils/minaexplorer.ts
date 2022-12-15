function makeAccountUrl(publicKey58: string | null): string {
  return `https://berkeley.minaexplorer.com/wallet/${publicKey58 || 'no-contract-address'}`;
}


export {makeAccountUrl}