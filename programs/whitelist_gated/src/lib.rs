use solana_program::pubkey::Pubkey;
use anchor_lang::prelude::*;
use anchor_lang::system_program;
use anchor_spl::{
    token::{mint_to, MintTo},
    metadata::{
        create_metadata_accounts_v3,
        mpl_token_metadata::types::DataV2,
        CreateMetadataAccountsV3,
    },
};

pub mod error;
pub mod state;
use crate::state::*;

// This is your program's public key and it will update
// automatically when you build the project.
declare_id!("EDoGnMTnYUUGt6bvGUZ96HdA77vC9MUUTRfjdVnKxyG8");

#[program]
mod whitelist_gated {
    use super::*;
    pub fn init_token(ctx: Context<InitToken>, metadata: InitTokenParams, whitelist: InitWhiteListParams) -> Result<()> {
        let seeds = &["mint".as_bytes(), &[ctx.bumps.mint]];
        let signer = [&seeds[..]];
        let token_data: DataV2 = DataV2 {
            name: metadata.name,
            symbol: metadata.symbol,
            uri: metadata.uri,
            seller_fee_basis_points: 0,
            creators: None,
            collection: None,
            uses: None,
        };

        let metadata_ctx = CpiContext::new_with_signer(
            ctx.accounts.token_metadata_program.to_account_info(),
            CreateMetadataAccountsV3 {
                payer: ctx.accounts.payer.to_account_info(),
                update_authority: ctx.accounts.mint.to_account_info(),
                mint: ctx.accounts.mint.to_account_info(),
                metadata: ctx.accounts.metadata.to_account_info(),
                mint_authority: ctx.accounts.mint.to_account_info(),
                system_program: ctx.accounts.system_program.to_account_info(),
                rent: ctx.accounts.rent.to_account_info(),
            },
            &signer
        );

        create_metadata_accounts_v3(metadata_ctx, token_data, false, true, None)?;

        let white_list_storage = &mut ctx.accounts.white_list_storage;

        white_list_storage.authority = ctx.accounts.payer.key();
        white_list_storage.immutable = false;
        white_list_storage.price = whitelist.price;
        white_list_storage.limit = whitelist.limit;

        for address in whitelist.list {
            white_list_storage.list.push(ClaimedList {
                address,
                claimed: 0,
                deleted: false,
            });
        }

        ctx.accounts.receive.amount = 0;

        msg!("Initialized everything.");

        Ok(())
    }

    pub fn insert_into_whitelist(ctx: Context<UpdateWhiteList>, addresses: Vec<Pubkey>) -> Result<()> {
        require_keys_eq!(
            ctx.accounts.payer.key(),
            ctx.accounts.white_list_storage.authority,
            error::ErrorCodes::NotOwner
        );

        let white_list = &mut ctx.accounts.white_list_storage.list;

        for address in addresses {
            let mut update = false;
            'inner: for i in white_list.iter_mut() {
                let default = ClaimedList {
                    address,
                    claimed: 0,
                    deleted: false,
                };
                if *i == default {
                    i.deleted = false;
                    update = true;
                    break 'inner;
                }
            }
            if !update {
                white_list.push(ClaimedList {
                    address,
                    claimed: 0,
                    deleted: false,
                });
            }
        }

        Ok(())
    }

    pub fn delete_from_whitelist(ctx: Context<UpdateWhiteList>, addresses: Vec<Pubkey>) -> Result<()> {
        require_keys_eq!(
            ctx.accounts.payer.key(),
            ctx.accounts.white_list_storage.authority,
            error::ErrorCodes::NotOwner
        );

        require!(
            !ctx.accounts.white_list_storage.immutable,
            error::ErrorCodes::ImmutedList,
        );

        let white_list = &mut ctx.accounts.white_list_storage.list;

        for address in addresses {
            'inner: for i in white_list.iter_mut() {
                let default = ClaimedList {
                    address,
                    claimed: 0,
                    deleted: false,
                };
                if *i == default {
                    i.deleted = true;
                    break 'inner;
                }
            }
        }
    
        Ok(())
    }
    
    pub fn immute_whitelist(ctx: Context<UpdateWhiteList>) -> Result<()> {
        require_keys_eq!(
            ctx.accounts.payer.key(),
            ctx.accounts.white_list_storage.authority,
            error::ErrorCodes::NotOwner
        );

        require!(
            !ctx.accounts.white_list_storage.immutable,
            error::ErrorCodes::ImmutedList,
        );

        ctx.accounts.white_list_storage.immutable = true;

        Ok(())
    }

    pub fn transfer_white_list_authority(ctx: Context<UpdateWhiteList>, new_owner: Pubkey) -> Result<()> {
        require_keys_eq!(
            ctx.accounts.payer.key(),
            ctx.accounts.white_list_storage.authority,
            error::ErrorCodes::NotOwner
        );

        require!(
            !ctx.accounts.white_list_storage.immutable,
            error::ErrorCodes::ImmutedList,
        );

        ctx.accounts.white_list_storage.authority = new_owner;
        
        Ok(())
    }

    pub fn update_price(ctx: Context<UpdateWhiteList>, new_price: u64) -> Result<()> {
        require_keys_eq!(
            ctx.accounts.payer.key(),
            ctx.accounts.white_list_storage.authority,
            error::ErrorCodes::NotOwner
        );

        require!(
            !ctx.accounts.white_list_storage.immutable,
            error::ErrorCodes::ImmutedList,
        );

        ctx.accounts.white_list_storage.price = new_price;

        Ok(())
    }

    pub fn update_limit(ctx: Context<UpdateWhiteList>, limit: u64) -> Result<()> {
        require_keys_eq!(
            ctx.accounts.payer.key(),
            ctx.accounts.white_list_storage.authority,
            error::ErrorCodes::NotOwner
        );

        require!(
            !ctx.accounts.white_list_storage.immutable,
            error::ErrorCodes::ImmutedList,
        );

        ctx.accounts.white_list_storage.limit = limit;

        Ok(())
    }

    pub fn withdraw_all(ctx: Context<Withdraw>) -> Result<()> {
        require_keys_eq!(
            ctx.accounts.payer.key(),
            ctx.accounts.white_list_storage.authority,
            error::ErrorCodes::NotOwner
        );

        let amount_to_send = ctx.accounts.receive.amount;

        require!(
            amount_to_send != 0,
            error::ErrorCodes::NoCollection
        );
        
        ctx.accounts.receive.sub_lamports(amount_to_send)?;
        ctx.accounts.payer.add_lamports(amount_to_send)?;

        ctx.accounts.receive.amount = 0;       

        Ok(())
    }

    pub fn mint_tokens(ctx: Context<MintTokens>, quantity: u64) -> Result<()> {
        let seeds = &["mint".as_bytes(), &[ctx.bumps.mint]];
        let signer = [&seeds[..]];

        let user = ctx.accounts.payer.key();
        let white_list_storage =  &mut ctx.accounts.white_list_storage;
        let limit = white_list_storage.limit;

        let mut on_white_list: i64 = -1;
        let mut count = 0;
        for i in white_list_storage.list.iter_mut() {
            let default = ClaimedList {
                address: user,
                claimed: 0,
                deleted: false
            };
            if *i == default {
                if !i.deleted {
                    on_white_list = count;
                    break;
                }
            }
            count += 1;
        }

        require!(on_white_list != -1 , error::ErrorCodes::NotOnWhiteList);

        let white_list_user = &mut white_list_storage.list[on_white_list as usize];
        white_list_user.claimed += quantity;
        
        require!(
            white_list_user.claimed <= limit,
            error::ErrorCodes::MoreQuantity
        );

        let amount = quantity * white_list_storage.price / u64::pow(10, 9);

        let cpi_context = CpiContext::new(
            ctx.accounts.system_program.to_account_info(),
            system_program::Transfer {
                from: ctx.accounts.payer.to_account_info().clone(),
                to: ctx.accounts.receive.to_account_info().clone(),
            },
        );

        system_program::transfer(cpi_context, amount)?;
        ctx.accounts.receive.amount += amount;

        mint_to(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                MintTo {
                    authority: ctx.accounts.mint.to_account_info(),
                    to: ctx.accounts.destination.to_account_info(),
                    mint: ctx.accounts.mint.to_account_info(),
                },
                &signer
            ),
            quantity,
        )?;
        
        Ok(())
    }
}