import { BlockFrostAPI } from "@blockfrost/blockfrost-js";
import { Blockfrost, Data, Lucid } from "lucid-cardano";

import { ADA, BlockfrostAdapter, calculateSwapExactIn, Dex, NetworkId, PoolDatum } from "@minswap/sdk";

async function main() {
  const network = "Preprod";
  const blockfrostProjectId = "<APIkey>";
  const blockfrostUrl = "https://cardano-preprod.blockfrost.io/api/v0";

  const address = "addr_test1vpc0nc5gmuz9e58pztqandrdc7knemt5ezflpp82g398pqs23w7wn";
  const lucid = await getBackendLucidInstance( network, blockfrostProjectId, blockfrostUrl, address );

  const blockfrostAdapter = new BlockfrostAdapter({ blockFrost: new BlockFrostAPI({ projectId: blockfrostProjectId, network: "preprod" }) });

  const utxos = await lucid.utxosAt(address);

  const txComplete = await _swapExactInTxExample( network, lucid, blockfrostAdapter, address, utxos );
  const signedTx = await txComplete
    .signWithPrivateKey("<privKey>")
    .complete();
  const txId = await signedTx.submit();
  // eslint-disable-next-line no-console
  console.log(`Transaction submitted successfully: ${txId}`);
}

async function getPoolById( network, blockfrostAdapter, poolId ) {
  const pool = await blockfrostAdapter.getPoolById({ id: poolId });
  if (!pool) {
    throw new Error(`Not found PoolState of ID: ${poolId}`);
  }

  const rawRoolDatum = await blockfrostAdapter.getDatumByDatumHash( pool.datumHash );
  const poolDatum = PoolDatum.fromPlutusData(
    network === "Mainnet" ? NetworkId.MAINNET : NetworkId.TESTNET,
    // @fixme check Data
     Data.from(rawRoolDatum) as Constr<Data>
    //Data.from(rawRoolDatum)
  );
  return { poolState: pool, poolDatum: poolDatum };
}

async function _swapExactInTxExample( network, lucid, blockfrostAdapter, address, availableUtxos ) {
  // ID of ADA-MIN Pool on Testnet Preprod
  const poolId = "3bb0079303c57812462dec9de8fb867cef8fd3768de7f12c77f6f0dd80381d0d";

  const { poolState, poolDatum } = await getPoolById( network, blockfrostAdapter, poolId );

  const swapAmountADA = 10_000_000n;

  const { amountOut } = calculateSwapExactIn({
    amountIn: swapAmountADA,
    reserveIn: poolState.reserveA,
    reserveOut: poolState.reserveB,
  });

  // Because pool is always fluctuating, so you should determine the impact of amount which you will receive
  const slippageTolerance = 20n;
  const acceptedAmount = (amountOut * (100n - slippageTolerance)) / 100n;

  const dex = new Dex(lucid);
  return await dex.buildSwapExactInTx({
    amountIn: swapAmountADA,
    assetIn: ADA,
    assetOut: poolDatum.assetB,
    minimumAmountOut: acceptedAmount,
    isLimitOrder: false,
    sender: address,
    availableUtxos: availableUtxos,
  });
}

/**
 * Initialize Lucid Instance for Backend Environment
 * @param network Network you're working on
 * @param projectId Blockfrost API KEY
 * @param blockfrostUrl Blockfrost URL
 * @param address Your own address
 * @returns
 */
async function getBackendLucidInstance( network, projectId, blockfrostUrl, address ) {
  const provider = new Blockfrost(blockfrostUrl, projectId);
  const lucid = await Lucid.new(provider, network);
  lucid.selectWalletFrom({ address });
  return lucid;
}

main();
