# coinflip-frontend

This repo uses the example `Add` contract and supports:

- Local mina interaction via `contracts/interact-local.ts`
- Berkeley mina interaction via `contracts/interact.ts`
- Berkeley mina interaction, via Auro wallet, via the frontend
- Local mina interaction, via Mina.transaction, via the frontend

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

The best option is to use the Makefile:

```
# Build contract deps along with the ui, and run the ui
make ui
# CTRL+C when done
# make clean if you need to refresh the build
```

Else:
```
# Building + Running
cd ui
npm install && npm run dev
open http://localhost:3000/
```

### Known issues

#### ui

- TODOs
  - Berkeley readiness
    - Need to deploy to Berkeley and make our contract value defined in `ui/utils/constants.ts`
    - Need to implement Berkeley withdrawl/deposit flow using transaction JSON
  - Need to implement sequential deposits + withdrawls.
  - Error handling when fetching accounts has different interface based on a Local fetch versus Berkeley fetch; this should be standardized