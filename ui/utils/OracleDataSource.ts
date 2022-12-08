import {networkConfig} from './constants';

export class OracleDataSource {
  static async get() {
    const url = networkConfig[networkConfig.currentNetwork].oracleUrl;
    const result = await fetch(url);
    const json = await result.json();
    return json;
  }
}