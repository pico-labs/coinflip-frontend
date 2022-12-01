.PHONY: all ui clean

all: .make.ui .make.contracts

ui: .make.ui .make.contracts
	cd ui && npm run dev;

clean:
	rm .make.*

.make.ui:
	cd ui && npm install
	touch .make.ui

.make.contracts: contracts/src/Add.ts contracts/src/Add.test.ts contracts/src/index.ts contracts/src/interact-local.ts contracts/src/interact.ts
	cd contracts && npm install && npm run build;
	touch .make.contracts
