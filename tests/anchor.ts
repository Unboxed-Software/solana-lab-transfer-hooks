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

  before('Airdrop SOL', async () => {
    await airdropSolIfNeeded(wallet.payer, provider.connection);
  });

  it('Create NFT Account with Transfer Hook Extension', async () => {});

  it('Create Token Accounts and Mint Tokens', async () => {});

  it('Create ExtraAccountMetaList Account', async () => {});

  it('Transfer Hook with Extra Account Meta', async () => {});
});
