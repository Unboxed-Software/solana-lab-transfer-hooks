use anchor_lang::{ prelude::*, system_program::{ create_account, CreateAccount } };
use anchor_spl::{
  token,
  token_interface::{ Mint, TokenAccount, TokenInterface },
};
use spl_transfer_hook_interface::instruction::{ ExecuteInstruction, TransferHookInstruction };
use spl_tlv_account_resolution::{ account::ExtraAccountMeta, seeds::Seed, state::ExtraAccountMetaList };

declare_id!("5FYsLEZ2vjDHmrs2UAVfDozy45zyPec26pjYvvgMiWhX");

#[program]
pub mod transfer_hook {
  use super::*;

  pub fn initialize_extra_account_meta_list(ctx: Context<InitializeExtraAccountMetaList>) -> Result<()> {
    // index 0-3 are the accounts required for token transfer (source, mint, destination, owner)
    // index 4 is the extra_account_meta_list account
    let account_metas = vec![
      // index 5, Token program
      ExtraAccountMeta::new_with_pubkey(&token::ID, false, false)?,
      // index 6, crumb mint
      ExtraAccountMeta::new_with_pubkey(&ctx.accounts.crumb_mint.key(), false, true)?, // is_writable true
      // index 7, mint authority
      ExtraAccountMeta::new_with_seeds(
        &[
          Seed::Literal {
            bytes: "mint-authority".as_bytes().to_vec(),
          },
        ],
        false, // is_signer
        false // is_writable
      )?,
      // index 8, ATA
      ExtraAccountMeta::new_with_pubkey(&ctx.accounts.crumb_mint_ata.key(), false, true)? // is_writable true
    ];

    // calculate account size
    let account_size = ExtraAccountMetaList::size_of(account_metas.len())? as u64;
    // calculate minimum required lamports
    let lamports = Rent::get()?.minimum_balance(account_size as usize);

    let mint = ctx.accounts.mint.key();
    let signer_seeds: &[&[&[u8]]] = &[&[b"extra-account-metas", &mint.as_ref(), &[ctx.bumps.extra_account_meta_list]]];

    // Create ExtraAccountMetaList account
    create_account(
      CpiContext::new(ctx.accounts.system_program.to_account_info(), CreateAccount {
        from: ctx.accounts.payer.to_account_info(),
        to: ctx.accounts.extra_account_meta_list.to_account_info(),
      }).with_signer(signer_seeds),
      lamports,
      account_size,
      ctx.program_id
    )?;

    // Initialize the account data to store the list of ExtraAccountMetas
    ExtraAccountMetaList::init::<ExecuteInstruction>(
      &mut ctx.accounts.extra_account_meta_list.try_borrow_mut_data()?,
      &account_metas
    )?;

    Ok(())
  }

  pub fn transfer_hook(ctx: Context<TransferHook>, _amount: u64) -> Result<()> {
    let signer_seeds: &[&[&[u8]]] = &[&[b"mint-authority", &[ctx.bumps.mint_authority]]];
    // mint a crumb token for each transaction
    token::mint_to(
      CpiContext::new_with_signer(
        ctx.accounts.token_program.to_account_info(),
        token::MintTo {
          mint: ctx.accounts.crumb_mint.to_account_info(),
          to: ctx.accounts.crumb_mint_ata.to_account_info(),
          authority: ctx.accounts.mint_authority.to_account_info(),
        },
        signer_seeds
      ),
      1
    ).unwrap();

    Ok(())
  }

  // fallback instruction handler as workaround to anchor instruction discriminator check
  pub fn fallback<'info>(program_id: &Pubkey, accounts: &'info [AccountInfo<'info>], data: &[u8]) -> Result<()> {
    let instruction = TransferHookInstruction::unpack(data)?;

    // match instruction discriminator to transfer hook interface execute instruction
    // token2022 program CPIs this instruction on token transfer
    match instruction {
      TransferHookInstruction::Execute { amount } => {
        let amount_bytes = amount.to_le_bytes();

        // invoke custom transfer hook instruction on our program
        __private::__global::transfer_hook(program_id, accounts, &amount_bytes)
      }
      _ => {
        return Err(ProgramError::InvalidInstructionData.into());
      }
    }
  }
}

#[derive(Accounts)]
pub struct InitializeExtraAccountMetaList<'info> {
  #[account(mut)]
  payer: Signer<'info>,

  /// CHECK: ExtraAccountMetaList Account, must use these seeds
  #[account(
        mut,
        seeds = [b"extra-account-metas", mint.key().as_ref()], 
        bump
    )]
  pub extra_account_meta_list: AccountInfo<'info>,
  pub mint: InterfaceAccount<'info, Mint>,
  pub token_program: Interface<'info, TokenInterface>,
  pub system_program: Program<'info, System>,

  #[account(init, payer = payer, mint::decimals = 0, mint::authority = mint_authority)]
  pub crumb_mint: InterfaceAccount<'info, Mint>,

  /// CHECK: mint authority Account for crumb mint
  #[account(seeds = [b"mint-authority"], bump)]
  pub mint_authority: UncheckedAccount<'info>,

  /// CHECK: ATA Account for crumb mint
  pub crumb_mint_ata: UncheckedAccount<'info>,
}

// Order of accounts matters for this struct.
// The first 4 accounts are the accounts required for token transfer (source, mint, destination, owner)
// Remaining accounts are the extra accounts required from the ExtraAccountMetaList account
// These accounts are provided via CPI to this program from the Token Extension program
#[derive(Accounts)]
pub struct TransferHook<'info> {
  #[account(token::mint = mint, token::authority = owner)]
  pub source_token: InterfaceAccount<'info, TokenAccount>,
  pub mint: InterfaceAccount<'info, Mint>,
  #[account(token::mint = mint)]
  pub destination_token: InterfaceAccount<'info, TokenAccount>,
  /// CHECK: source token account owner
  pub owner: UncheckedAccount<'info>,

  /// CHECK: ExtraAccountMetaList Account,
  #[account(seeds = [b"extra-account-metas", mint.key().as_ref()], bump)]
  pub extra_account_meta_list: UncheckedAccount<'info>,

  pub token_program: Interface<'info, TokenInterface>,

  pub crumb_mint: InterfaceAccount<'info, Mint>,

  /// CHECK: mint authority Account,
  #[account(seeds = [b"mint-authority"], bump)]
  pub mint_authority: UncheckedAccount<'info>,

  #[account(token::mint = crumb_mint)]
  pub crumb_mint_ata: InterfaceAccount<'info, TokenAccount>,
}
