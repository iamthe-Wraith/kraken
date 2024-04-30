# Kraken

Kraken is a simple tool to help you find the hashes for commits you want to release. For now, you can manually run the tool, pass it the strings you want to look for in the git log (probably something like Jira ticket numbers), and it will return the hashes for the commits that contain those strings.

![A cute little kraken splashing in the water and playing with a toy boat](./kraken.png)

## Installation

1. Add `kraken.sh` to `/usr/local/bin` (or another directory in your `$PATH`)
2. Make sure it's executable: `chmod +x /usr/local/bin/kraken.sh`
3. [Optional by recommended] Add an alias to your shell configuration file (e.g. `~/.bashrc` or `~/.zshrc`): `alias kraken="/usr/local/bin/kraken.sh"`

## Usage

1. Run `kraken.sh`
- (*if you added an alias as recommended above, you only need to run `kraken` in your terminal*)
2. Follow the prompts
3. Take the commit hashes and *Release the Kraken!*

