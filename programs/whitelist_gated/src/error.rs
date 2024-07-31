use anchor_lang::prelude::*;

#[error_code]
pub enum ErrorCodes {
    #[msg("Only owner can call this function!")]
    NotOwner,
    #[msg("Whitelist is immutable")]
    ImmutedList,
    #[msg("Not on the whitelist")]
    NotOnWhiteList,
    #[msg("Minting more than required")]
    MoreQuantity,
    #[msg("No SOL available to withdraw")]
    NoCollection,
}