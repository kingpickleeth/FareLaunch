// src/flows/finalize.ts
import { SLIPPAGE_BPS, TX_DEADLINE_MINUTES } from '../config/launch';
import { applySlippageDown, minutesFromNow } from '../utils/slippage';
import { Contract } from 'ethers';

// assume we pair TOKEN with WAPE
export async function addLiquidityV2({
  router,          // ethers Contract for Camelot/UniswapV2 router
  token,           // ethers Contract for our ERC20 token
  tokenAmount,     // bigint
  wapeAmount,      // bigint (native WAPE)
  recipient,       // LP token receiver (e.g., locker)
}: {
  router: Contract;
  token: Contract;
  tokenAmount: bigint;
  wapeAmount: bigint;
  recipient: string;
}) {
  await token.approve(await router.getAddress(), tokenAmount);

  const amountTokenMin = applySlippageDown(tokenAmount, SLIPPAGE_BPS);
  const amountWapeMin  = applySlippageDown(wapeAmount,  SLIPPAGE_BPS);
  const deadline       = minutesFromNow(TX_DEADLINE_MINUTES);

  const tx = await router.addLiquidityETH(
    await token.getAddress(),
    tokenAmount,           // amountTokenDesired
    amountTokenMin,        // amountTokenMin
    amountWapeMin,         // amountETHMin
    recipient,             // to
    deadline,              // deadline
    { value: wapeAmount }  // msg.value = WAPE native
  );
  return tx.wait();
}
