use anchor_lang::{ prelude::*, system_program::{ create_account, CreateAccount } };
use anchor_spl::{ token, token_interface::{ Mint, TokenAccount, TokenInterface } };
use spl_transfer_hook_interface::instruction::{ ExecuteInstruction, TransferHookInstruction };
use spl_tlv_account_resolution::{ account::ExtraAccountMeta, seeds::Seed, state::ExtraAccountMetaList };

declare_id!("YOUR_PROGRAM_ID_HERE");

#[program]
pub mod transfer_hook {
    use super::*;

    pub fn initialize_extra_account_meta_list(
        ctx: Context<InitializeExtraAccountMetaList>,
    ) -> Result<()> {
        Ok(())
    }

    pub fn transfer_hook(ctx: Context<TransferHook>, amount: u64) -> Result<()> {
        Ok(())
    }

    pub fn fallback<'info>(
        program_id: &Pubkey,
        accounts: &'info [AccountInfo<'info>],
        data: &[u8],
    ) -> Result<()> {
        Ok(())
    }
}

#[derive(Accounts)]
pub struct InitializeExtraAccountMetaList {}

#[derive(Accounts)]
pub struct TransferHook {}
