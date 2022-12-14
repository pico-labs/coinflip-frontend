import {PublicKey} from 'snarkyjs';

function makeAccountUrl(publicKey58: string | null): string {
  return `https://minascan.io/berkeley/account/${publicKey58 || 'no-contract-address'}/zkApp?limit=50&orderBy=ASC&page=0&sortBy=fee`;
}


export {makeAccountUrl}