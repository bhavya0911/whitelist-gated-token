import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { WhitelistGated } from "../target/types/whitelist_gated";
import { assert } from "chai";

describe("whitelist_gated", () => {
  // Configure the client to use the local cluster.
  anchor.setProvider(anchor.AnchorProvider.env());

  const program = anchor.workspace.WhitelistGated as Program<WhitelistGated>;

    // Metaplex Constants
    const METADATA_SEED = "metadata";
    const TOKEN_METADATA_PROGRAM_ID = new anchor.web3.PublicKey("metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s");
  
    // Constants from our program
    const MINT_SEED = "mint";
    const WHITE_LIST_SEED = "whitelist";
    const RECEIVE_SEED = "receive";
  
    // Wallets for our tests
    const payer = anchor.getProvider().publicKey;
    const otherWallet = anchor.web3.Keypair.generate();
    const otherTwoWallet = anchor.web3.Keypair.generate();
    const otherThreeWallet = anchor.web3.Keypair.generate();
    const nonWhiteListed = anchor.web3.Keypair.generate();
    
    const [whiteListAddress] = anchor.web3.PublicKey.findProgramAddressSync([Buffer.from(WHITE_LIST_SEED)], program.programId);
    const whiteList = {
      list: [payer],
      limit: new anchor.BN(5000000000),
      price: new anchor.BN(1),
    };
  
    const [mint] = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from(MINT_SEED)],
      program.programId
    );
  
    const name = "Test";
    const symbol = "TKT";
    const uri = "https://5vfxc4tr6xoy23qefqbj4qx2adzkzapneebanhcalf7myvn5gzja.arweave.net/7UtxcnH13Y1uBCwCnkL6APKsge0hAgacQFl-zFW9NlI";
    const decimals = 10;
  
    const metadata = {
      name,
      symbol,
      uri,
      decimals,
    };
  
    const [metadataAddress] = anchor.web3.PublicKey.findProgramAddressSync(
      [
        Buffer.from(METADATA_SEED),
        TOKEN_METADATA_PROGRAM_ID.toBuffer(),
        mint.toBuffer(),
      ],
      TOKEN_METADATA_PROGRAM_ID
    );
  
    const [receiveAddress] = anchor.web3.PublicKey.findProgramAddressSync([Buffer.from(RECEIVE_SEED)], program.programId);

    it("Initialize other wallets", async () => {
      const transaction = new anchor.web3.Transaction().add(
        anchor.web3.SystemProgram.transfer({
          fromPubkey: anchor.getProvider().publicKey,
          toPubkey: otherWallet.publicKey,
          lamports: 300000000,
        }),
      );

      const transaction1 = new anchor.web3.Transaction().add(
        anchor.web3.SystemProgram.transfer({
          fromPubkey: anchor.getProvider().publicKey,
          toPubkey: otherTwoWallet.publicKey,
          lamports: 100000000,
        }),
      );

      const transaction2 = new anchor.web3.Transaction().add(
        anchor.web3.SystemProgram.transfer({
          fromPubkey: anchor.getProvider().publicKey,
          toPubkey: nonWhiteListed.publicKey,
          lamports: 100000000,
        }),
      );
      
      await anchor.getProvider().sendAndConfirm(transaction);
      await anchor.getProvider().sendAndConfirm(transaction1);
      await anchor.getProvider().sendAndConfirm(transaction2);
  })

    describe("initialize", async () => {

      const context = {
        metadata: metadataAddress,
        mint,
        whiteListStorage: whiteListAddress,
        receive: receiveAddress,
        payer,
        rent: anchor.web3.SYSVAR_RENT_PUBKEY,
        systemProgram: anchor.web3.SystemProgram.programId,
        tokenProgram: anchor.utils.token.TOKEN_PROGRAM_ID,
        tokenMetadataProgram: TOKEN_METADATA_PROGRAM_ID,
      };

      it("initialized properly", async () => {

        const info = await anchor.getProvider().connection.getAccountInfo(mint);
        if (info) {
          return; // Do not attempt to initialize if already initialized
        }

        const txHash = await program.methods
          .initToken(metadata, whiteList)
          .accounts(context)
          .rpc();

        await anchor.getProvider().connection.confirmTransaction(txHash, 'finalized');

        const whiteListState = await program.account.whiteList.fetch(whiteListAddress);
        assert.equal(whiteList.list[0].toBase58(), whiteListState.list[0].address.toBase58());
        assert.equal(whiteList.limit.words[0], whiteListState.limit.words[0]);
        assert.equal(whiteList.price.words[0], whiteListState.price.words[0]);
        assert.equal(payer.toBase58(), whiteListState.authority.toBase58());

        const receiveState = await program.account.receive.fetch(receiveAddress);
        assert.equal(0, receiveState.amount.words[0]);

      });

  });

  describe("insert_into_whitelist", async () => {

    const list = [otherWallet.publicKey, otherTwoWallet.publicKey, otherThreeWallet.publicKey];

    it("Reverts for Non-authority account", async () => {

      const context  = {
        whiteListStorage: whiteListAddress,
        payer: otherWallet.publicKey,
      };

      try {
        const txHash = await program.methods
        .insertIntoWhitelist(list)
        .accounts(context)
        .signers([otherWallet])
        .rpc();

        await anchor.getProvider().connection.confirmTransaction(txHash, 'finalized');
      } catch (error) {
        assert.equal("NotOwner", error.error.errorCode.code);
      }

    });

    it("Adds a new address to whitelist", async () => {

      const context = {
        whiteListStorage: whiteListAddress,
        payer
      };

      const prevWhiteListStateList = (await program.account.whiteList.fetch(whiteListAddress)).list;
      
      const txHash = await program.methods
        .insertIntoWhitelist(list)
        .accounts(context)
        .rpc()

      await anchor.getProvider().connection.confirmTransaction(txHash, 'finalized');     
      const newWhiteListStateList = (await program.account.whiteList.fetch(whiteListAddress)).list;

      assert.equal(prevWhiteListStateList.length + list.length, newWhiteListStateList.length, "1");
      for(let i = 0; i < list.length; i++) {
        assert.equal(list[i].toBase58(), newWhiteListStateList[newWhiteListStateList.length - (list.length - i)].address.toBase58());
      }

    });

    it("Flips deleted to false for previously added account", async () => {
      
      const context = {
        whiteListStorage: whiteListAddress,
        payer
      };

      const txHash = await program.methods
        .deleteFromWhitelist(list)
        .accounts(context)
        .rpc()

      await anchor.getProvider().connection.confirmTransaction(txHash, 'finalized');

      const prevWhiteListStateList = (await program.account.whiteList.fetch(whiteListAddress)).list;
      
      const txHash1 = await program.methods
        .insertIntoWhitelist(list)
        .accounts(context)
        .rpc()

      await anchor.getProvider().connection.confirmTransaction(txHash1, 'finalized');     
      const newWhiteListStateList = (await program.account.whiteList.fetch(whiteListAddress)).list;

      assert.equal(prevWhiteListStateList.length, newWhiteListStateList.length);
      for(let i = 0; i < list.length; i++) {
        assert.equal(list[i].toBase58(), newWhiteListStateList[newWhiteListStateList.length - (list.length - i)].address.toBase58());
      }

    });

  });

  describe("delete_from_whitelist", async () => {

    const list = [otherTwoWallet.publicKey, otherThreeWallet.publicKey];

    it("Reverts for Non-authority account", async () => {

      const context  = {
        whiteListStorage: whiteListAddress,
        payer: otherWallet.publicKey,
      };

      try {
        const txHash = await program.methods
        .deleteFromWhitelist(list)
        .accounts(context)
        .signers([otherWallet])
        .rpc();

        await anchor.getProvider().connection.confirmTransaction(txHash, 'finalized');
      } catch (error) {
        assert.equal("NotOwner", error.error.errorCode.code);
      }
      
    })

    it("Flips deleted to false for account list", async () => {

      const context  = {
        whiteListStorage: whiteListAddress,
        payer,
      };

      const prevWhiteListStateList = (await program.account.whiteList.fetch(whiteListAddress)).list;

      const txHash = await program.methods
        .deleteFromWhitelist(list)
        .accounts(context)
        .rpc()

      await anchor.getProvider().connection.confirmTransaction(txHash, 'finalized');
      const newWhiteListStateList = (await program.account.whiteList.fetch(whiteListAddress)).list;

      assert.equal(prevWhiteListStateList.length, newWhiteListStateList.length);
      try {
      for(let i = 0; i < list.length; i++) {
        assert.equal(true, newWhiteListStateList[newWhiteListStateList.length - (list.length - i)].deleted);
      }
      } catch(error) {
        assert.equal("NotOnWhiteList", error.error.errorCode.code)
      }

    });

  });

  describe("update_price", async () => {

    const newPrice = new anchor.BN(5000000);

    it("Reverts for Non-authority account", async () => {

      const context = {
        whiteListStorage: whiteListAddress,
        payer: otherWallet.publicKey,
      };

      try {
        const txHash =  await program.methods
          .updatePrice(newPrice)
          .accounts(context)
          .signers([otherWallet])
          .rpc();
        await anchor.getProvider().connection.confirmTransaction(txHash, 'finalized');

      } catch (error) {
        assert.equal("NotOwner", error.error.errorCode.code);
      }
      
    })

    it("Price is updated as expected", async () => {

      const context =  {
        whiteListStorage: whiteListAddress,
        payer,
      };

      const txHash = await program.methods
        .updatePrice(newPrice)
        .accounts(context)
        .rpc();
      await anchor.getProvider().connection.confirmTransaction(txHash, 'finalized');

      const newPriceOnChain = (await program.account.whiteList.fetch(whiteListAddress)).price;
      assert.equal(newPrice.words[0], newPriceOnChain.words[0]);

    });

  });

  describe("update_limit", async () => {

    const newLimit = new anchor.BN(40000000000);

    it("Reverts for Non-authority account", async () => {

      const context = {
        whiteListStorage: whiteListAddress,
        payer: otherWallet.publicKey,
      };

      try {
        const txHash =  await program.methods
          .updateLimit(newLimit)
          .accounts(context)
          .signers([otherWallet])
          .rpc();
        await anchor.getProvider().connection.confirmTransaction(txHash, 'finalized');

      } catch (error) {
        assert.equal("NotOwner", error.error.errorCode.code);
      }
      
    });

    it("Limit is updated as expected", async () => {

      const context =  {
        whiteListStorage: whiteListAddress,
        payer,
      };

      const txHash = await program.methods
        .updateLimit(newLimit)
        .accounts(context)
        .rpc();
      await anchor.getProvider().connection.confirmTransaction(txHash, 'finalized');

      const newPriceOnChain = (await program.account.whiteList.fetch(whiteListAddress)).limit;
      assert.equal(newLimit.words[0], newPriceOnChain.words[0]);

    });

  });

  describe("transfer_white_list_authority", async () => {

    const newOwner = otherWallet.publicKey;

    it("Reverts for Non-authority account", async () => {

      const context = {
        whiteListStorage: whiteListAddress,
        payer: otherWallet.publicKey,
      };

      try {
        const txHash =  await program.methods
          .transferWhiteListAuthority(newOwner)
          .accounts(context)
          .signers([otherWallet])
          .rpc();
        await anchor.getProvider().connection.confirmTransaction(txHash, 'finalized');

      } catch (error) {
        assert.equal("NotOwner", error.error.errorCode.code);
      }
      
    });

    it("Changes authority address as expected", async () => {

      const context =  {
        whiteListStorage: whiteListAddress,
        payer,
      };

      const txHash = await program.methods
        .transferWhiteListAuthority(newOwner)
        .accounts(context)
        .rpc();
      await anchor.getProvider().connection.confirmTransaction(txHash, 'finalized');

      const newOwnerOnChain = (await program.account.whiteList.fetch(whiteListAddress)).authority;
      assert.equal(otherWallet.publicKey.toBase58(), newOwnerOnChain.toBase58());

      const context1 = {
        whiteListStorage: whiteListAddress,
        payer: otherWallet.publicKey,
      }

      const txHash1 = await program.methods
        .transferWhiteListAuthority(payer)
        .accounts(context1)
        .signers([otherWallet])
        .rpc();
      await anchor.getProvider().connection.confirmTransaction(txHash, 'finalized');

      const latestOwnerOnChain = (await program.account.whiteList.fetch(whiteListAddress)).authority;
      assert.equal(payer.toBase58(), latestOwnerOnChain.toBase58());
      
    });
    
  });

  describe("mint tokens", async () => {

    it("Non-whitelisted account cannot mint", async () => {
      
      let find = false;
      const list = (await program.account.whiteList.fetch(whiteListAddress)).list;
      for(let i = 0; i < list.length; i++) {
        if(list[0].address.toBase58() == nonWhiteListed.publicKey.toBase58()) {
          find = true;
        }
      }
      assert.equal(find, false);

      const destination = await anchor.utils.token.associatedAddress({
        mint: mint,
        owner: nonWhiteListed.publicKey,
      });

      const mintAmount = 2;

      let initialBalance: number;
      try {
        const balance = (await anchor.getProvider().connection.getTokenAccountBalance(destination))
        initialBalance = balance.value.uiAmount;
      } catch {
        // Token account not yet initiated has 0 balance
        initialBalance = 0;
      }

      const mintContext = {
        mint,
        destination,
        receive: receiveAddress,
        whiteListStorage: whiteListAddress,
        payer: nonWhiteListed.publicKey,
        rent: anchor.web3.SYSVAR_RENT_PUBKEY,
        systemProgram: anchor.web3.SystemProgram.programId,
        tokenProgram: anchor.utils.token.TOKEN_PROGRAM_ID,
        tokenMetadataProgram: TOKEN_METADATA_PROGRAM_ID,
        associatedTokenProgram: anchor.utils.token.ASSOCIATED_PROGRAM_ID,
      }

      try {
        const txHash = await program.methods
          .mintTokens(new anchor.BN(mintAmount * 10 ** metadata.decimals))
          .accounts(mintContext)
          .signers([nonWhiteListed])
          .rpc();
        await anchor.getProvider().connection.confirmTransaction(txHash);
      } catch (error) {
        assert.equal("NotOnWhiteList", error.error.errorCode.code);
      }

    });

    it("Deleted accounts from Whitelisted cannot mint", async () => {
      
      const destination = await anchor.utils.token.associatedAddress({
        mint: mint,
        owner: otherTwoWallet.publicKey,
      });

      const mintAmount = 2;

      let initialBalance: number;
      try {
        const balance = (await anchor.getProvider().connection.getTokenAccountBalance(destination))
        initialBalance = balance.value.uiAmount;
      } catch {
        // Token account not yet initiated has 0 balance
        initialBalance = 0;
      }

      const mintContext = {
        mint,
        destination,
        receive: receiveAddress,
        whiteListStorage: whiteListAddress,
        payer: otherTwoWallet.publicKey,
        rent: anchor.web3.SYSVAR_RENT_PUBKEY,
        systemProgram: anchor.web3.SystemProgram.programId,
        tokenProgram: anchor.utils.token.TOKEN_PROGRAM_ID,
        tokenMetadataProgram: TOKEN_METADATA_PROGRAM_ID,
        associatedTokenProgram: anchor.utils.token.ASSOCIATED_PROGRAM_ID,
      }

      try {
        const txHash = await program.methods
          .mintTokens(new anchor.BN(mintAmount * 10 ** metadata.decimals))
          .accounts(mintContext)
          .signers([otherTwoWallet])
          .rpc();
        await anchor.getProvider().connection.confirmTransaction(txHash);
      } catch (error) {
        assert.equal("NotOnWhiteList", error.error.errorCode.code);
      }
    });

    it("Whitegated wallet mint within alloted amount at static price", async () => {

      const destination = await anchor.utils.token.associatedAddress({
        mint: mint,
        owner: otherWallet.publicKey,
      });

      const mintAmount = 2;
      let initialBalance: number;
      try {
        const balance = (await anchor.getProvider().connection.getTokenAccountBalance(destination))
        initialBalance = balance.value.uiAmount;
      } catch {
        // Token account not yet initiated has 0 balance
        initialBalance = 0;
      }

      const mintContext = {
        mint,
        destination,
        receive: receiveAddress,
        whiteListStorage: whiteListAddress,
        payer: otherWallet.publicKey,
        rent: anchor.web3.SYSVAR_RENT_PUBKEY,
        systemProgram: anchor.web3.SystemProgram.programId,
        tokenProgram: anchor.utils.token.TOKEN_PROGRAM_ID,
        tokenMetadataProgram: TOKEN_METADATA_PROGRAM_ID,
        associatedTokenProgram: anchor.utils.token.ASSOCIATED_PROGRAM_ID,
      }

      const previousBalance = (await anchor.getProvider().connection.getAccountInfo(otherWallet.publicKey)).lamports;
      const price = (await program.account.whiteList.fetch(whiteListAddress)).price.words[0]

      const txHash = await program.methods
        .mintTokens(new anchor.BN(mintAmount * 10 ** metadata.decimals))
        .accounts(mintContext)
        .signers([otherWallet])
        .rpc();
      await anchor.getProvider().connection.confirmTransaction(txHash);

      const postBalance = (
        await anchor.getProvider().connection.getTokenAccountBalance(destination)
      ).value.uiAmount;
      assert.equal(
        initialBalance + mintAmount,
        postBalance,
        "Post balance should equal initial plus mint amount"
      );

      const newBalance = (await anchor.getProvider().connection.getAccountInfo(otherWallet.publicKey)).lamports;
      const amountTransferred = previousBalance - newBalance;
      assert.equal(amountTransferred > mintAmount * price, true);

    });

    it("Whitelisted account cannot mint more than alloted", async () => {

      const destination = await anchor.utils.token.associatedAddress({
        mint: mint,
        owner: otherWallet.publicKey,
      });

      let claimed = 0;
      const limit = new anchor.BN((await program.account.whiteList.fetch(whiteListAddress)).limit.words[0]).toNumber()
      const list = (await program.account.whiteList.fetch(whiteListAddress)).list
      for(let i = 0; i < list.length; i++) {
        if(list[i].address.toBase58() == otherWallet.publicKey.toBase58()) {
          claimed = new anchor.BN(list[i].claimed.words[0]).toNumber();
        }
      }
      const mintAmount = new anchor.BN(limit - claimed + 1);

      let initialBalance: number;
      try {
        const balance = (await anchor.getProvider().connection.getTokenAccountBalance(destination))
        initialBalance = balance.value.uiAmount;
      } catch {
        // Token account not yet initiated has 0 balance
        initialBalance = 0;
      }

      const mintContext = {
        mint,
        destination,
        receive: receiveAddress,
        whiteListStorage: whiteListAddress,
        payer: otherWallet.publicKey,
        rent: anchor.web3.SYSVAR_RENT_PUBKEY,
        systemProgram: anchor.web3.SystemProgram.programId,
        tokenProgram: anchor.utils.token.TOKEN_PROGRAM_ID,
        tokenMetadataProgram: TOKEN_METADATA_PROGRAM_ID,
        associatedTokenProgram: anchor.utils.token.ASSOCIATED_PROGRAM_ID,
      }
      
      try {
        const txHash = await program.methods
        .mintTokens(mintAmount)
        .accounts(mintContext)
        .signers([otherWallet])
        .rpc();
        await anchor.getProvider().connection.confirmTransaction(txHash);
      } catch(error) {
        assert.equal("MoreQuantity", error.error.errorCode.code);
      }

    });

    it("Even deleting & re-inserting doesn't change claimed", async () => {

      let currentClaimed = 0;
      const list = (await program.account.whiteList.fetch(whiteListAddress)).list;
      for(let i = 0; i < list.length; i++) {
        if(list[i].address.toBase58() == otherWallet.publicKey.toBase58()) {
          currentClaimed = list[i].claimed.words[0];
        }
      }

      const context = {
        whiteListStorage: whiteListAddress,
        payer,
      }

      const txHash = await program.methods
        .deleteFromWhitelist([otherWallet.publicKey])
        .accounts(context)
        .rpc();
      await anchor.getProvider().connection.confirmTransaction(txHash);

      let newList = {};
      const list2 = (await program.account.whiteList.fetch(whiteListAddress)).list;
      for(let i = 0; i < list2.length; i++) {
        if(list[i].address.toBase58() == otherWallet.publicKey.toBase58()) {
          newList = list2[i];
        }
      }

      assert.equal(currentClaimed, newList.claimed.words[0]);
      assert.equal(true, newList.deleted);

    });

  });

  describe("immute_whitelist", async () => {

    it("Reverts for Non-authority account", async () => {

      const context = {
        whiteListStorage: whiteListAddress,
        payer: otherWallet.publicKey,
      };

      try {
        const txHash = await program.methods
          .immuteWhitelist()
          .accounts(context)
          .signers([otherWallet])
          .rpc();

        await anchor.getProvider().connection.confirmTransaction(txHash);    
      } catch (error) {
        assert.equal("NotOwner", error.error.errorCode.code);
      }
      
    })

    it("Immutes whitelist by reverting any whitelist changes", async () => {

      const context = {
        whiteListStorage: whiteListAddress,
        payer,
      };
      
      const txHash = await program.methods
        .immuteWhitelist()
        .accounts(context)
        .rpc();
      await anchor.getProvider().connection.confirmTransaction(txHash);

      const result = true;
      const immutable = (await program.account.whiteList.fetch(whiteListAddress)).immutable;
      assert.equal(result, immutable);

      try {
        const txHash1 = await program.methods
          .deleteFromWhitelist([payer])
          .accounts(context)
          .rpc();
        await anchor.getProvider().connection.confirmTransaction(txHash1);
      } catch (error) {
        assert.equal("ImmutedList", error.error.errorCode.code);
      }

    });
    
  });

  describe("withdraw_all", async () => {

    it("Reverts for non-authority account", async () => {

      const context = {
        whiteListStorage: whiteListAddress,
        receive: receiveAddress,
        payer: otherWallet.publicKey,
      };

      try {
        const txHash = await program.methods
          .withdrawAll()
          .accounts(context)
          .signers([otherWallet])
          .rpc();

        await anchor.getProvider().connection.confirmTransaction(txHash);     
      } catch (error) {
        assert.equal("NotOwner", error.error.errorCode.code);
      }

    });

    it("Withdraws exactly from the receive account", async () => {
      
      const context = {
        whiteListStorage: whiteListAddress,
        receive: receiveAddress,
        payer,
      };

      const previousBalance = (await anchor.getProvider().connection.getAccountInfo(receiveAddress)).lamports
      const amountToBeTransfered = new anchor.BN((await program.account.receive.fetch(receiveAddress)).amount).toNumber()

      const txHash = await program.methods
        .withdrawAll()
        .accounts(context)
        .rpc();
      await anchor.getProvider().connection.confirmTransaction(txHash);

      const newBalance = (await anchor.getProvider().connection.getAccountInfo(receiveAddress)).lamports
      assert.equal(amountToBeTransfered, previousBalance - newBalance);

      
    });

    it("Reverts when amount is zero", async () => {

      const context = {
        whiteListStorage: whiteListAddress,
        receive: receiveAddress,
        payer,
      };

      try {
        const txHash = await program.methods
          .withdrawAll()
          .accounts(context)
          .rpc();

        await anchor.getProvider().connection.confirmTransaction(txHash);     
      } catch (error) {
        assert.equal("NoCollection", error.error.errorCode.code);
      }

    });

  });

});