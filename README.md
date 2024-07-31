# Whitelist-Gated Token Sale Program

## Description

This project implements a whitelist-gated sale program for a new token on the Solana blockchain. The program is developed using Anchor, allowing users on a whitelist to participate in the token sale. The token price is static, and there's a purchase limit per wallet address to ensure fair distribution.

## Features

- Whitelist-gated access to the token sale
- Static token pricing
- Per-wallet purchase limits
- Built on Solana blockchain using Anchor framework

## Prerequisites

- Rust (latest stable version)
- Solana CLI tools
- Anchor framework
- yarn

## Installation

1. Clone the repository:
```sh
git clone https://github.com/bhavya0911/white-list-gated-token
```

2. Install dependencies:
```sh
yarn install
```

3. Build the project:
```sh
anchor build
```

4. Find program_id of program:
```sh
anchor keys list
```

5. Replace the program_id in `programs/whitelist_gated/src/lib.rs` at:
```rust
declare_id!("6qT6LcdeL21WhwrqeFTaQQfdWgdB7YskNKG1sD2sC7xC");
```

6. Build the program again:
```sh
anchor build
```

## Usage

1. Deploy the program to Solana devnet:
```sh
anchor deploy --provider.cluster devnet
```

2. Run tests on Localnet:
```sh
anchor test
```

3. To run tests on devnet:
```sh
anchor test --provider.cluster devnet
```
## Program Structure

- `programs/whitelist_gated/src/lib.rs`: Main program logic
- `tests/`: Test files for the program

## Configuration

Modify the `Anchor.toml` file to adjust program settings, such as:
- Program ID
- Cluster (e.g., devnet, testnet, mainnet)
- Test settings

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

This project is licensed under the [MIT License](LICENSE).

## Disclaimer

This program is for educational purposes only. Use at your own risk. Always ensure proper testing and auditing before deploying to mainnet.