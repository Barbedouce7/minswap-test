// @target: ES2020

import { BlockFrostAPI } from "@blockfrost/blockfrost-js";
import invariant from "./node_modules/@minswap/tiny-invariant/dist/tiny-invariant.js";
import {
  Address,
  Blockfrost,
  Constr,
  Data,
  Lucid,
  Network,
  OutRef,
  TxComplete,
  UTxO,
} from "./node_modules/lucid-cardano/web/mod.js";

import {
  ADA,
  Asset,
  BlockfrostAdapter,
  calculateDeposit,
  calculateSwapExactIn,
  calculateSwapExactOut,
  calculateWithdraw,
  calculateZapIn,
  Dex,
  NetworkId,
  PoolDatum,
  PoolState,
} from "@minswap/sdk";

async function main(): Promise<void> {
  const network: Network = "Preprod";
  const blockfrostProjectId = "<api key>";
  const blockfrostUrl = "https://cardano-preprod.blockfrost.io/api/v0";

  const address = "<address>";
  const lucid = await getBackendLucidInstance(
    network,
    blockfrostProjectId,
    blockfrostUrl,
    address
  );

  const blockfrostAdapter = new BlockfrostAdapter({
    blockFrost: new BlockFrostAPI({
      projectId: blockfrostProjectId,
      network: "preprod",
    }),
  });

  const utxos = await lucid.utxosAt(address);

  const txComplete = await _swapExactInTxExample(
    network,
    lucid,
    blockfrostAdapter,
    address,
    utxos
  );
  const signedTx = await txComplete
    .signWithPrivateKey("<privkey>")
    .complete();
  const txId = await signedTx.submit();
  // eslint-disable-next-line no-console
  console.log(`Transaction submitted successfully: ${txId}`);
}


async function _swapExactInTxExample(
  network: Network,
  lucid: Lucid,
  blockfrostAdapter: BlockfrostAdapter,
  address: Address,
  availableUtxos: UTxO[]
): Promise<TxComplete> {
  // ID of ADA-MIN Pool on Testnet Preprod
  const poolId =
    "3bb0079303c57812462dec9de8fb867cef8fd3768de7f12c77f6f0dd80381d0d";

  const { poolState, poolDatum } = await getPoolById(
    network,
    blockfrostAdapter,
    poolId
  );

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


async function getPoolById(
  network: Network,
  blockfrostAdapter: BlockfrostAdapter,
  poolId: string
): Promise<{ poolState: PoolState; poolDatum: PoolDatum }> {
  const pool = await blockfrostAdapter.getPoolById({
    id: poolId,
  });
  if (!pool) {
    throw new Error(`Not found PoolState of ID: ${poolId}`);
  }

  const rawRoolDatum = await blockfrostAdapter.getDatumByDatumHash(
    pool.datumHash
  );
  const poolDatum = PoolDatum.fromPlutusData(
    network === "Mainnet" ? NetworkId.MAINNET : NetworkId.TESTNET,
    Data.from(rawRoolDatum) as Constr<Data>
  );
  return {
    poolState: pool,
    poolDatum: poolDatum,
  };
}



/**
 * Initialize Lucid Instance for Backend Environment
 * @param network Network you're working on
 * @param projectId Blockfrost API KEY
 * @param blockfrostUrl Blockfrost URL
 * @param address Your own address
 * @returns
 */
async function getBackendLucidInstance(
  network: Network,
  projectId: string,
  blockfrostUrl: string,
  address: Address
): Promise<Lucid> {
  const provider = new Blockfrost(blockfrostUrl, projectId);
  const lucid = await Lucid.new(provider, network);
  lucid.selectWalletFrom({
    address: address,
  });
  return lucid;
}

void main();

