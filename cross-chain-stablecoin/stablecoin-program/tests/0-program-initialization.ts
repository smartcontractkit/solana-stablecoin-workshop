import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { StablecoinProgram } from "../target/types/stablecoin_program";

describe("stablecoin-program", () => {
  // Configure the client to use the local cluster.
  anchor.setProvider(anchor.AnchorProvider.env());

  const program = anchor.workspace.stablecoinProgram as Program<StablecoinProgram>;

  it("Is initialized!", async () => {
    // Add your test here.
    console.log("Available methods:", Object.keys(program.methods));
    console.log("Program has the following instructions: initializeMint, depositAndMint, burnAndWithdraw");
  });
});
