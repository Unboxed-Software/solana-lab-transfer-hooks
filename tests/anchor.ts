import * as anchor from '@coral-xyz/anchor';
import { TransferHook } from '../target/types/transfer_hook';
import { Keypair, PublicKey, sendAndConfirmTransaction, SystemProgram, Transaction } from '@solana/web3.js';
import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  AuthorityType,
  createAssociatedTokenAccountInstruction,
  createInitializeMetadataPointerInstruction,
  createInitializeMintInstruction,
  createInitializeTransferHookInstruction,
  createMintToInstruction,
  createSetAuthorityInstruction,
  createTransferCheckedWithTransferHookInstruction,
  ExtensionType,
  getAssociatedTokenAddressSync,
  getMint,
  getMintLen,
  LENGTH_SIZE,
  TOKEN_2022_PROGRAM_ID,
  TYPE_SIZE,
} from '@solana/spl-token';
import { createInitializeInstruction, pack } from '@solana/spl-token-metadata';
import { expect } from 'chai';
import { airdropSolIfNeeded, getMetadataObject } from '../helpers/helpers';

describe('transfer-hook', () => {
  // Configure the client to use the local cluster.
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.TransferHook as anchor.Program<TransferHook>;

  const wallet = provider.wallet as anchor.Wallet;

  const connection = provider.connection;

  // Generate keypair to use as address for the transfer-hook enabled mint
  const mint = new Keypair();

  const crumbMint = new Keypair();

  // Sender token account address
  const sourceTokenAccount = getAssociatedTokenAddressSync(
    mint.publicKey,
    wallet.publicKey,
    false,
    TOKEN_2022_PROGRAM_ID,
    ASSOCIATED_TOKEN_PROGRAM_ID,
  );

  // Recipient token account address
  const recipient = Keypair.generate();
  console.log('Recipient:', recipient.publicKey.toBase58());
  const destinationTokenAccount = getAssociatedTokenAddressSync(
    mint.publicKey,
    recipient.publicKey,
    false,
    TOKEN_2022_PROGRAM_ID,
    ASSOCIATED_TOKEN_PROGRAM_ID,
  );

  // ExtraAccountMetaList address
  // Store extra accounts required by the custom transfer hook instruction
  const [extraAccountMetaListPDA] = PublicKey.findProgramAddressSync(
    [Buffer.from('extra-account-metas'), mint.publicKey.toBuffer()],
    program.programId,
  );

  // PDA from the transfer hook program to be used as the mint authority for the crumb mint
  const [crumbMintAuthority] = PublicKey.findProgramAddressSync([Buffer.from('mint-authority')], program.programId);

  // Associated token account for the crumb mint
  const crumbMintATA = getAssociatedTokenAddressSync(crumbMint.publicKey, crumbMintAuthority, true);

  before('Airdrop SOL', async () => {
    await airdropSolIfNeeded(wallet.payer, provider.connection);
  });

  it('Creates an NFT with Transfer Hook Extension and Metadata', async () => {
    const metadata = await getMetadataObject({
      connection,
      imagePath: 'helpers/cool-cookie.png',
      tokenName: 'Cool Cookie',
      tokenSymbol: 'COOKIE',
      tokenDescription: 'A cool cookie',
      mintPublicKey: mint.publicKey,
      additionalMetadata: [],
      payer: wallet.payer,
    });

    // NFT Should have 0 decimals
    const decimals = 0;

    const extensions = [ExtensionType.TransferHook, ExtensionType.MetadataPointer];
    const mintLen = getMintLen(extensions);
    const metadataLen = TYPE_SIZE + LENGTH_SIZE + pack(metadata).length;
    const lamports = await connection.getMinimumBalanceForRentExemption(mintLen + metadataLen);

    const transaction = new Transaction().add(
      SystemProgram.createAccount({
        fromPubkey: wallet.publicKey,
        newAccountPubkey: mint.publicKey,
        space: mintLen,
        lamports: lamports,
        programId: TOKEN_2022_PROGRAM_ID,
      }),
      createInitializeMetadataPointerInstruction(
        mint.publicKey,
        wallet.publicKey,
        mint.publicKey,
        TOKEN_2022_PROGRAM_ID,
      ),
      createInitializeTransferHookInstruction(
        mint.publicKey,
        wallet.publicKey,
        program.programId, // Transfer Hook Program ID
        TOKEN_2022_PROGRAM_ID,
      ),
      createInitializeMintInstruction(mint.publicKey, decimals, wallet.publicKey, null, TOKEN_2022_PROGRAM_ID),
      createInitializeInstruction({
        programId: TOKEN_2022_PROGRAM_ID,
        mint: mint.publicKey,
        metadata: mint.publicKey,
        name: metadata.name,
        symbol: metadata.symbol,
        uri: metadata.uri,
        mintAuthority: wallet.publicKey,
        updateAuthority: wallet.publicKey,
      }),
    );

    const txSig = await sendAndConfirmTransaction(provider.connection, transaction, [wallet.payer, mint]);
    console.log(
      'Transaction Signature:',
      `https://explorer.solana.com/tx/${txSig}?cluster=custom&customUrl=http%3A%2F%2Flocalhost%3A8899`,
    );
  });

  // Create the two token accounts for the transfer-hook enabled mint
  // Fund the sender token account with 100 tokens
  it('Creates Token Accounts and Mint The NFT', async () => {
    // 1 NFT
    const amount = 1;

    const transaction = new Transaction().add(
      createAssociatedTokenAccountInstruction(
        wallet.publicKey,
        sourceTokenAccount,
        wallet.publicKey,
        mint.publicKey,
        TOKEN_2022_PROGRAM_ID,
        ASSOCIATED_TOKEN_PROGRAM_ID,
      ),
      createAssociatedTokenAccountInstruction(
        wallet.publicKey,
        destinationTokenAccount,
        recipient.publicKey,
        mint.publicKey,
        TOKEN_2022_PROGRAM_ID,
        ASSOCIATED_TOKEN_PROGRAM_ID,
      ),
      createMintToInstruction(mint.publicKey, sourceTokenAccount, wallet.publicKey, amount, [], TOKEN_2022_PROGRAM_ID),
      createSetAuthorityInstruction(
        mint.publicKey,
        wallet.publicKey,
        AuthorityType.MintTokens,
        null,
        [],
        TOKEN_2022_PROGRAM_ID,
      ),
    );

    const txSig = await sendAndConfirmTransaction(connection, transaction, [wallet.payer], { skipPreflight: true });

    console.log(
      'Transaction Signature:',
      `https://explorer.solana.com/tx/${txSig}?cluster=custom&customUrl=http%3A%2F%2Flocalhost%3A8899`,
    );
  });

  // Account to store extra accounts required by the transfer hook instruction
  it('Initializes ExtraAccountMetaList Account and Creates the ATA for the Crumb Mint', async () => {
    const initializeExtraAccountMetaListInstruction = await program.methods
      .initializeExtraAccountMetaList()
      .accounts({
        mint: mint.publicKey,
        extraAccountMetaList: extraAccountMetaListPDA,
        crumbMint: crumbMint.publicKey,
        crumbMintAta: crumbMintATA,
      })
      .instruction();

    const transaction = new Transaction().add(
      initializeExtraAccountMetaListInstruction,
      createAssociatedTokenAccountInstruction(wallet.publicKey, crumbMintATA, crumbMintAuthority, crumbMint.publicKey),
    );

    const txSig = await sendAndConfirmTransaction(provider.connection, transaction, [wallet.payer, crumbMint], {
      skipPreflight: true,
      commitment: 'confirmed',
    });
    console.log(
      'Transaction Signature:',
      `https://explorer.solana.com/tx/${txSig}?cluster=custom&customUrl=http%3A%2F%2Flocalhost%3A8899`,
    );
  });

  it('Transfers the NFT and the transfer hook mints a crumb token for each transfer', async () => {
    const amount = 1;
    const bigIntAmount = BigInt(amount);

    // Standard token transfer instruction
    const transferInstruction = await createTransferCheckedWithTransferHookInstruction(
      connection,
      sourceTokenAccount,
      mint.publicKey,
      destinationTokenAccount,
      wallet.publicKey,
      bigIntAmount,
      0, // Decimals
      [],
      'confirmed',
      TOKEN_2022_PROGRAM_ID,
    );

    const transferBackInstruction = await createTransferCheckedWithTransferHookInstruction(
      connection,
      destinationTokenAccount,
      mint.publicKey,
      sourceTokenAccount,
      recipient.publicKey,
      bigIntAmount,
      0, // Decimals
      [],
      'confirmed',
      TOKEN_2022_PROGRAM_ID,
    );

    const transaction = new Transaction().add(transferInstruction, transferBackInstruction);

    const txSig = await sendAndConfirmTransaction(connection, transaction, [wallet.payer, recipient], {
      skipPreflight: true,
    });
    console.log(
      'Transfer Signature:',
      `https://explorer.solana.com/tx/${txSig}?cluster=custom&customUrl=http%3A%2F%2Flocalhost%3A8899`,
    );

    const mintInfo = await getMint(connection, crumbMint.publicKey, 'processed');
    console.log('Mint Info:', Number(mintInfo.supply));

    expect(Number(mintInfo.supply)).to.equal(2);
  });
});
