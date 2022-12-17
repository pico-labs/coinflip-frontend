# coinflip-frontend

This repo is part of a submission to [ZK Ignite Cohort 0](https://minaprotocol.com/blog/zkignite-cohort0_), with these related repositories:

- Oracle: https://github.com/pico-labs/randomness-oracle
- Contract: https://github.com/pico-labs/coinflip-executor-contract

The deployed project can be viewed at https://coinflip-frontend-ruby.vercel.app/

This frontend uses Next.js and is modeled on the [Mina Protocol's Tutorial 4: Building a zkApp UI in the Browser with React](https://docs.minaprotocol.com/zkapps/tutorials/zkapp-ui-with-react).

## Development

Locally, this repo has a dependency on the randomness-oracle linked above.

For running locally, you need to set values in the `ui/` subdirectory's .env file and then install and run.

You should start by running:

```
cd ui;
cp env.example .env
```

### Required values in the .env file

- `APP_NETWORK` - LOCAL or BERKELEY
- `RANDOMNESS_ORACLE_URL` - This is the url of the randomness oracle; it is set to the local URL of the randomness oracle in the [randomness-oracle repo](https://github.com/pico-labs/randomness-oracle).
- `EXECUTOR_PRIVATE_KEY` - This is the private key of the deployed [coinflip-executor-contract](https://github.com/pico-labs/coinflip-executor-contract) for the given network. It is set to a randomly generated private key

### Build and run

- NB: changes to the .env require a server restart in order to take effect!

```
cd ui;
npm install
npm run dev
```

## What does the app do?

The application allows the user to deposit collateral, flip a virtual coin as long they have collateral, and based on the result of the coin flip, their collateral is automatically increased or decreased. Once they are done, they can withdraw their collateral, including winnings and losses.

See below image for more info.

![Loaded page](https://user-images.githubusercontent.com/12632889/208014152-b4a69e13-c4c8-42cc-9738-0bf714b68018.png)

But first, the user has to enter a private key into the form in the application so they can sign transactions; until they do that, they see everything in a loading state.

Once they have done that, they see the above fully loaded state.

There are 5 buttons that allow:

- Flipping the coin (requires collateral to work)
- Depositing collateral
- Withdrawing collateral + winnings/losses
- Fetching the up to date balances for the user account and contract account
- Fetching the up to date Merkle tree state for the on-chain ZK App state and the off-chain ZK App state.

There are also two sections each of two cards.

The first set of cards show the Mina account balances of the user's account and the contract.

The second set of cards provides information about the on-chain and off-chain Merkle tree states,
and also shows winnings and losses.

### Here's how to flip a coin, see your results, and withdraw.

- Enter private key at the top and wait for everything to load
- Once everything is loaded, click the blue "Deposit" button
  - You will see your "Local State" card at the bottom show an updated collateral value very quickly
  - You will have to wait for your transaction to be mined before you can see the updated contract balance, but in the meantime, you can click the "Refresh states and balances" button every so often until your balance is updated.
- At this point, you have identical on-chain and off-chain states in the Merkle State cards, and can click the flip coin button.
- Once the flip coin transaction is mined, you will automatically see your winnings for your Local State card at the bottom of the page.
- You should then have identical Merkle Root hashes in the page, indicating that the on-chain and off-chain states are in sync.
- You can flip as many times as you like, as long as you have collateral!
- Once you're done, you can withdraw, and your initial collateral +/- winnings/losses will be sent to you.

Thanks for playing!
