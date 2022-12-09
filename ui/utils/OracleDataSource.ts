import {networkConfig} from './constants';

export class OracleDataSource {
  static async get() {
    try {
      const currentNetwork = networkConfig.currentNetwork as 'LOCAL'  | 'BERKELEY'
      const url = networkConfig[currentNetwork].oracleUrl;
      const result = await fetch(url);
      const json = await result.json();
      return json;
    } catch (err) {
      console.error(err);
      return {error: err};
    }
  }
}