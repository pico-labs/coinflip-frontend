# coinflip-frontend

This repo uses the example `Add` contract and supports:

- Local mina interaction via `contracts/interact-local.ts`
- Berkeley mina interaction via `contracts/interact.ts`
- Berkeley mina interaction, via Auro wallet, via the frontend

## Building and running

### contracts

```
# Building:
cd contracts
npm install && npm run build && npm run test

# Running:
# At this point, if you want, you can interact with the contract locally or on Berkeley; each
# NPM script auto-builds the contract as well.

# Local
npm run interact-local

# Berkeley, requires private key in .env
npm run interact
```

### ui

```
# Building + Running
cd ui
npm install && npm run dev
open http://localhost:3000/
```

### Known issues

#### ui

- [Built frontend does not seem to include service workers, making cross-origin headers not load, and entire app fail](https://discord.com/channels/484437221055922177/1046962321249017907/1047237453704089621)

  - Does not affect local dev but will matter when we deploy
  - Can be reproed locally with

    ```
    npm run build && npm run export && npm run start
    open http://localhost:3000/
    ```
