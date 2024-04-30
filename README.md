# Kraken

Kraken is a little tool to help save you time by finding the hashes for commits you want to release.

When you run the tool, you can pass it any number of strings you want to look for in the git log (usually something like Jira ticket or GitHub issue id's). Kraken will then search your project's git log for those strings and return the hashes of any commits that contain them. You can then have Kraken create a  new release branch, cherry-pick those commits into it, and then create a new PR for you! 🐙

![A cute little kraken splashing in the water and playing with a toy boat](./kraken.png)

## Setup

### Mac

1. Add `kraken.sh` to `/usr/local/bin` (or another directory in your `$PATH`)
2. Make sure it's executable: `chmod +x /usr/local/bin/kraken.sh`

[**Optional but Recommended**]

3. Add an alias to your shell configuration file (e.g. `~/.bashrc` or `~/.zshrc`):

```sh
alias kraken="/usr/local/bin/kraken.sh"
```

4. Source your shell configuration file: `source ~/.bashrc` or `source ~/.zshrc`

🐙 *you may need to use `sudo` for these commands*

### Linux  🔜

### Windows  🔜


## Usage

1. Run `kraken.sh` in your terminal (*if you added an alias as recommended above, you only need to run `kraken`*)
2. Follow the prompts
3. *Release the Kraken!*

🐙 *If any of your queries are not found, Kraken will let you know and you can try again.*
