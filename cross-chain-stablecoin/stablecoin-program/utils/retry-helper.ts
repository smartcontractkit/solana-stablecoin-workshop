import * as anchor from "@coral-xyz/anchor"

/**
 * Enhanced retry helper for handling Solana network instability
 * Specifically addresses "Blockhash not found" errors with exponential backoff
 */
export async function retryTransaction(
  connection: anchor.web3.Connection,
  fn: (blockhash: string) => Promise<string>,
  maxRetries = 3
): Promise<string> {
  for (let i = 0; i < maxRetries; i++) {
    try {
      const { blockhash } = await connection.getLatestBlockhash('confirmed')
      const signature = await fn(blockhash)

      // Wait for confirmation
      const latestBlockhash = await connection.getLatestBlockhash('confirmed')
      await connection.confirmTransaction({
        signature,
        blockhash: latestBlockhash.blockhash,
        lastValidBlockHeight: latestBlockhash.lastValidBlockHeight,
      }, 'confirmed')

      return signature
    } catch (error: any) {
      console.log(`⚠️ Attempt ${i + 1} failed: ${error.message}`)
      if (i === maxRetries - 1) throw error

      const delay = Math.pow(2, i) * 2000 // 2s, 4s, 8s
      console.log(`⏳ Waiting ${delay/1000}s before retry...`)
      await new Promise(resolve => setTimeout(resolve, delay))
    }
  }
  throw new Error("All retry attempts failed")
}

/**
 * Simplified retry for basic RPC calls
 */
export async function retryRpcCall<T>(
  fn: () => Promise<T>,
  maxRetries = 3
): Promise<T> {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn()
    } catch (error: any) {
      console.log(`⚠️ RPC attempt ${i + 1} failed: ${error.message}`)
      if (i === maxRetries - 1) throw error

      const delay = Math.pow(2, i) * 1000 // 1s, 2s, 4s
      console.log(`⏳ Waiting ${delay/1000}s before retry...`)
      await new Promise(resolve => setTimeout(resolve, delay))
    }
  }
  throw new Error("All RPC retry attempts failed")
}

