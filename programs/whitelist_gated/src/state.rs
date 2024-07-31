use solana_program::pubkey::Pubkey;
use std::mem::size_of;
use anchor_lang::prelude::*;
use anchor_spl::{
    associated_token::AssociatedToken,
    token::{Mint, Token, TokenAccount},
    metadata::{
        Metadata as Metaplex,
    },
};

#[account]
pub struct WhiteList {
    pub list: Vec<ClaimedList>,
    pub authority: Pubkey,
    pub immutable: bool,
    pub limit: u64,
    pub price: u64,
}

#[account]
pub struct Receive {
    pub amount: u64,
}

#[derive(Accounts)]
#[instruction(params: InitTokenParams)]
pub struct InitToken<'info> {
    #[account[mut]]
    /// CHECK: for further safety
    pub metadata: UncheckedAccount<'info>,
    #[account(
        init,
        seeds = [b"mint"],
        bump,
        payer = payer,
        mint::decimals = params.decimals,
        mint::authority = mint,
    )]
    pub mint: Account<'info, Mint>,
    #[account(
        init,
        space = 8 + size_of::<WhiteList>() + (32 + 8 + 1) * 200,
        seeds = [b"whitelist"],
        bump,
        payer = payer,
    )]
    pub white_list_storage: Account<'info, WhiteList>,
    #[account(
        init,
        space = 8 + size_of::<Receive>(),
        seeds = [b"receive"],
        bump,
        payer = payer,
    )]
    pub receive: Account<'info, Receive>,
    #[account(mut)]
    pub payer: Signer<'info>,
    pub rent: Sysvar<'info, Rent>,
    pub system_program: Program<'info, System>,
    pub token_program: Program<'info, Token>,
    pub token_metadata_program: Program<'info, Metaplex>,
}

#[derive(Accounts)]
pub struct UpdateWhiteList<'info> {
    #[account(
        mut,
        seeds = [b"whitelist"],
        bump,
    )]
    pub white_list_storage: Account<'info, WhiteList>,
    pub payer: Signer<'info>,
}

#[derive(Accounts)]
pub struct MintTokens<'info> {
    #[account(
        mut,
        seeds = [b"mint"],
        bump,
        mint::authority = mint,
    )]
    pub mint: Account<'info, Mint>,
    #[account(
        init_if_needed,
        payer = payer,
        associated_token::mint = mint,
        associated_token::authority = payer,
    )]
    pub destination: Account<'info, TokenAccount>,
    #[account(
        mut,
        seeds = [b"receive"],
        bump,
    )]
    pub receive: Account<'info, Receive>,
    #[account(
        mut,
        seeds = [b"whitelist"],
        bump,
    )]
    pub white_list_storage: Account<'info, WhiteList>,
    #[account(mut)]
    pub payer: Signer<'info>,
    //REMOVE IT
    pub rent: Sysvar<'info, Rent>,
    pub system_program: Program<'info, System>,
    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>
}

#[derive(Accounts)]
pub struct Withdraw<'info> {
    #[account(
        seeds = [b"whitelist"],
        bump,
    )]
    pub white_list_storage: Account<'info, WhiteList>,
    #[account(
        mut,
        seeds = [b"receive"],
        bump,
    )]
    pub receive: Account<'info, Receive>,
    #[account(mut)]
    pub payer: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(AnchorSerialize, AnchorDeserialize, Debug, Clone)]
pub struct InitTokenParams {
    pub name: String,
    pub symbol: String,
    pub uri: String,
    pub decimals: u8,
}

#[derive(AnchorSerialize, AnchorDeserialize, Debug, Clone)]
pub struct InitWhiteListParams {
    pub list: Vec<Pubkey>,
    pub limit: u64,
    pub price: u64,
}

#[derive(AnchorSerialize, AnchorDeserialize, Debug, Clone)]
pub struct ClaimedList {
    pub address: Pubkey,
    pub claimed: u64,
    pub deleted: bool
}

impl PartialEq for ClaimedList {
    fn eq(&self, other: &Self) -> bool {
        self.address == other.address
    }
}