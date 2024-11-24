# kraken

Kraken is the beast you want on your side when you're managing releases. It can handle pulling issues that are ready to be released, prepare all the data, and create your pull request (or merge request). It will even attempt to handle those annoying cherry-picks for you.

>Our team releases at least 4 times per week. It used to take about 1 hour for each 1. But once we started using Kraken, we can how get most of our releases out in less than 5 minutes!

![A cute little kraken splashing in the water and playing with a toy boat](./kraken.png)

## Currently Supported Platforms

**Built For**
- MacOS (does not currently support Linux or Windows)
- NodeJS (does not currently support other Javascript runtimes)

**Integrated With**
- Jira
- GitHub

## Setup

The following steps will guide you through [installing](#installation) and [setting up](#setup) Kraken on your machine.

### Installation

#### 1. Install NodeJS
I've tested Kraken on Node v.18 and later. It *might* work on earlier versions, but I have not tested it on them, so run Kraken on earlier version at your own risk.

I suggest using [nvm](https://github.com/nvm-sh/nvm) to handle installing Node locally. It makes managing different versions of NodeJS much easier. To install nvm, you can follow [these instructions](https://github.com/nvm-sh/nvm?tab=readme-ov-file#installing-and-updating).

#### 2. Clone the Kraken repo
Run the following command to clone the Kraken repo down to your local machine.

`git clone https://github.com/iamthe-Wraith/kraken.git`

#### 3. Install
Run the following command to install Kraken on your local machine.

`npm install`

This will install all necessary dependencies, and will also run a post installation script to handle setting up the `.kraken` directory in your root directory, and will add the necessary configuration and templates files to it.

#### 4. Link
This tool uses the [bin](https://docs.npmjs.com/cli/v10/configuring-npm/package-json?v=true#bin) property in the package.json file to create a link inside the global bins directory which allows you to use the `kraken` command to execute the files in this project.

Run the following command to 

`npm link`

#### 5. Confirm
Run the following command to confirm your config and template files have been added.

`ls ~/.kraken`

you should see something like:

```
config.json	pr-template.md	temp
```

Now run the following command to confirm Kraken was linked successfully.

`kraken help`

If you see the help documentation printed in your terminal, you are good to go!

### Configuration

#### config.json
The `~/.kraken/config.json` file contains all the possible configuration options for Kraken. It's where you will store access tokens, api keys, and configure the tool to fit your needs. The following table provides information for each property that can be configured in this file.

| Property | Description |
| :-- | :-- |
| `jiraApiToken` | [REQUIRED TO USE THE JIRA PLATFORM] The access token required to access the [Jira Rest API v3](https://developer.atlassian.com/cloud/jira/platform/rest/v3/intro/#about), which allows Kraken to get resources like projects, statuses, and issues. To create an API Token, you can follow the steps found [here](https://support.atlassian.com/atlassian-account/docs/manage-api-tokens-for-your-atlassian-account/). |
| `jiraBaseUrl` | [REQUIRED TO USE THE JIRA PLATFORM] This is your Jira base url...the domain that will be used to make requests to the Jira Rest API. This domain is configured in the Atlassian Admin area when you [set up your organization and product](https://admin.atlassian.com). But an easy way to find this is just by looking at the address bar when you're on the Jira web application. You will need to save the full domain here. It will look something like `https://greenplaces.atlassian.net`. |
| `jiraEmail` | [REQUIRED TO USE THE JIRA PLATFORM] The email you use to sign in to Jira. |
| `jiraProjectId` | [OPTIONAL] The ID of the Jira project you will retrieving `statuses` and `issues` from. It's very common to be accessing this same project with most commands, so I added this configuration option as a convenience. In any commands where a project is needed, if this configuration option is set, it will be used and you will not have to provide it in the command. However, if you provide an ID as the project argument to the command, it will be used instead of this configuration option. |
| `githubToken` | [REQUIRED TO USE THE GITHUB PLATFORM] The access token required to access the [GitHub API](https://docs.github.com/en/rest?apiVersion=2022-11-28), which allows Kraken to do things like pull down changes from the remote, and create Pull Requests in GitHub. |
| `githubUsername` | [REQUIRED TO USE THE GITHUB PLATFORM] Your GitHub username. |
| `daysToKeepTempFiles` | [REQUIRED] The number of days certain (*but not all*) files will be stored in `~/.kraken/temp`. Currently this includes only files prefixed with `issues-`. Whenever the `kraken issues` command is used, during its cleanup phase, it will delete any temp files prefixed with `issues-` that are older than 30 days. |

## Jira/GitHub Example Workflow

When you are ready to start a release, you will almost always follow a similar flow. For one project I work on, we use Jira as our project management tool, and GitHub to manage our code. The following are the steps I use to create a release for that project.

### Step 1. Get the Project
*You can skip this step if you have already retrieved the project ID and stored it in your config file. (see `jiraProjectId` above)*

The first thing we need to do is get the ID of the Jira Project that houses all the issues that are going to be included in the release. We can use the `kraken issues` command to print all of our organization's projects, along with their IDs. To do this, run the command:

```
kraken projects jira
```

The output of this command will look something like:

```
PROJECTS
id    | key      | name
--------------------------------
10032 | BUG      | Bugs and Issues
10030 | DEV      | Development
--------------------------------
```
*Yours will of course be different, based on how your organization has set up its projects in Jira.*

Now we need to copy the ID of the project where our release issues live. For this example, we are going to use the Development project, so I am going to copy that project's ID, `10030`.

If you will frequently be using the same project with Kraken, it is recommended that you set this value as the `jiraProjectId` in your configuration file. Open `~/.kraken/config.json`, and paste the ID you just copied as the value of the `jiraProjectId` config option. Save and close the file.


### Step 2. Get the Statuses
Kraken is setup to retrieve all issues that are currently assigned to a specific status. Before we can do that, however, we need to get that status's ID. To do this, run the following command:

```
kraken statuses jira
```

If you didn't save the project ID to your config file in Step 1, you will need to include the project argument with the command

```
kraken statuses jira --project {PROJECT_ID}
# OR
kraken statuses jira -p {PROJECT_ID}
```

The output of this command will look something like:

```
JIRA STATUSES
id    | name
--------------------------------
10212 | Production QA
10133 | Development QA
10210 | Staging QA
10023 | Done
10024 | To Do
10211 | Ready for Staging
10187 | Blocked
10132 | Ready for Production
10087 | Code Review
3     | In Progress
--------------------------------
```

For this example, let's assume we are doing a Staging release, so we need all the issues that are currently in the `Ready for Staging` status. So we I will copy the ID `10211`.

### Step 3. Get the Issues
Now it's time to get all the issues that are Ready for Staging. To do this, run the following command

```
kraken issues jira -s {STATUS_ID}
```

This will print a table of all the issues that are Ready for Staging. It will look something like:

```
ISSUES
key        | summary
--------------------------------
DEV-1001   | Update Something
DEV-1003   | Fix a Bug
DEV-1009   | Add That Feature
--------------------------------
```

Note the table lists the issue `key` and the `summary`. The `key` is the identifier that is generated by Jira when the issue is created. Because this the Development project, and that project's key is `DEV` all our issues are prefixed with `DEV-` followed by a number. This `key` is what Kraken will search for (by default) in your git log later to identify the commits for that commit. The `summary`, on the other hand, is the description entered into the summary field in Jira. It is a human readable summary of the issue and is only included to help you know what issue is.

Once you're satisfied with the data, it's recommended that you run the command again, this time including the `-w` flag. This will tell Kraken to write the issues data to a temp file on your computer (as you will see, doing this will make executing later commands **much** easier).

```
kraken issues jira -s {STATUS_ID} -w
```

The output will be the same as above, except now, beneath the table, you will see a new line:

```
🎉  issues written to: /Users/{USERNAME}/.kraken/temp/issues-{TIMESTAMP}.json
```
*note that `{USERNAME}` will be your username on your computer, and `{TIMESTAMP}` will be the timestamp when the command was executed.*

Copy the filename `issues-{TIMESTAMP}.json`

### Step 4. [OPTIONAL]
It's common for some tickets to be excluded from a release. Perhaps it's a Story ticket that was broken up into multiple Subtasks, and there is no commit or pull request linked to it. In this case, you can open the temp file created in the previous step (/Users/{USERNAME}/.kraken/temp/issues-{TIMESTAMP}.json), and change the value of the `expectToFindInGitLog` property to `false` for the ticket in question. This will tell Kraken not to look for this issue in the git log in a later command.

Additionally, Kraken is configured by default to look for the issue's `key` in the git log. However, if your team does not include the `key` in your commits and/or pull requests titles, or someone forgets to include it by mistake, Kraken will not be able to find the commits associated with it. When this happens, you can update the issue's `keyOverride` value in the same file to some string that uniquely identifies the commit for that ticket in your git log. If there are multiple commits, and none have a consistent patter to use, you will need to copy the object in the file, duplicate it, and add a different `keyOverride` for each commit.

It is recommended that you add a commit/pull request policy to your team where commit messages and pull requests following a consistent naming pattern so you can easily find commits during this process (and easily link them to Jira issues if you ever need to). I personally favor the following naming conventions...

For commits I like the [Conventional Commit](https://www.conventionalcommits.org/en/v1.0.0/) pattern:
`feat: DEV-#### - description of changes in commit`

For pull requests, it's the same, minus the Conventional Commit type:
`DEV-#### - description of the issue`

### Step 5. Prepare the Release
Now that we have a list of all the issues to include in this release, we need to search the git log for all the commit hashes for every commit/pull request so they can cherry-picked in a later command. This is where the `kraken prepare` command comes in.

Before we actually write any data to files or try to cherry pick anything, I like to do a dry run to make sure that all the issues can be found in the git log. To do this, we can run this command:

```
kraken prepare -f issues-{TIMESTAMP}.json
```

The `--filename|-f` argument allows you use the contents of the file created in Step 3 as the input for this command. Kraken will read those contents, then iterate over each issue and attempt to find all the commits in the git log that include either the `keyOverride` value (if it's been set) or the `key`.

If any are not found, Kraken will print out a report of them so you can investigate why they couldn't be found. That report might look something like:

```
❌  NO KEYS FOUND

KEYS NOT FOUND
--------------------------------
DEV-1001
DEV-1003
DEV-1009
--------------------------------
```
*if none of the keys were found*

**--OR--**

```
KEYS FOUND
--------------------------------
DEV-1001
DEV-1003
--------------------------------

KEYS NOT FOUND
--------------------------------
DEV-1009
--------------------------------
```
*if only some of the issues were not found*


But if all the issues were found, Kraken will instead print out a report containing the commit hashes for each commit that was found, retaining the order they exist in git log (this is important when cherry-picking). That output will look something like:

```
HASHES
----------------newest----------------

48a2300  | refactor: DEV-1001 - updated something
67r8325  | fix: DEV-1003 - fixed something
72b1482  | feat: DEV-1009 - added a new feature

----------------oldest----------------
```

If everything looks good, we can now run the full command (remember, the first run through was just a dry run to make sure all the issues could be found and that the data looked good).

As I've mentioned, we will now want to cherry-pick all these commits into our release branch. Depending on the number of tickets, however, this can be a tedious task. The good news is Kraken can try to do this for us! Let's take a look at the command we will need to run, and then breakdown each piece:

```
kraken prepare github staging -f issues-{TIMESTAMP}.json -a -t "Staging-Release-{TIMESTAMP}"
```

breakdown...
- `kraken prepare` - the same command we ran for the dry run
- `github` - here are specifying what platform our release will be created for
- `staging` - the target branch for our release. since this is a Staging release, in the end, we will be merging all our commits into the `staging` branch, so `staging` is our target branch
- `-f issues-{TIMESTAMP}.json` - the file that contains our issues data that is to be used as input for the command
- `-a` - tells Kraken to **a**ttempt to cherry-pick the commits into a new release branch
- `-t "Staging-Release-{TIMESTAMP}"` - an optional argument that allows us to name the new feature branch (if this is not included, Kraken will generate the name of the feature branch for you)

So what all is this command doing?
1. Kraken reads the contents of the file specified in the `-f` argument
2. It will then search the git log (again) for all the commits that match the `keyOverride` or the `key` specified for each issue
3. Next it will write all the prepared data to a new file in `~/.kraken/temp`. this one will be prefixed with `prepared-`. This file is important for the next command, for historical record keeping, and will be used with new features that are coming in the future
4. Kraken will then create a new feature branch (because the `-a` flag was provided) named "Staging-Release-{TIMESTAMP}", add it to the remote, and attempt to cherry-pick each commit into it. If Kraken encounters any errors or merge conflicts during this process, it will abort the cherry-pick, delete the feature branch, and inform you that it was unable to complete the process and that you will need to perform the cherry-picks yourself. However, if it is successful, it will let you know that everything has been prepared and we are ready for the final step.

### Step 6. Create the Pull Request
In the previous step, either Kraken created a new feature branch and pushed it up to the remote, or you did so manually. Either way, we are now ready to create the Pull Request so the team can review the release before the changes are added to the target branch. While this step is relatively easy, adding all the tickets that are to be released into the pull request description can be a tedious process (especially if you need to include Jira links for every ticket so the GitHub/Jira integration can link the PR to each issue). Luckily, the `kraken release` command makes this easy. Run the following:

*before running this command, make sure you have the release branch created in the previous step checked out.*
```
kraken release github staging -p prepared-{TIMESTAMP}.json -t "Staging-Release-{TIMESTAMP}"
```

let's breakdown this command too...
- `kraken release` - the command
- `github` - the platform we are going to create the pull request on...in this case, GitHub
- `staging` - the target branch for our release. since this is a Staging release, in the end, we will be merging all our commits into the `staging` branch, so `staging` is our target branch
- `-p prepared-{TIMESTAMP}.json` - the the name of the file that contains the prepared data. If this argument is not set, the prepared data will be retrieved from the most recent prepared file in `.kraken/temp`. If no prepared file is found, this release command will exit and no pull request will be created
- `-t` - an optional argument that sets the Title of the pull request

What this command does...
1. Kraken reads the prepared data from the `prepared-{TIMESTAMP}.json` file.
2. Then it makes sure that the current release branch is in sync with the remote and no one has added anything extra to it
3. Next it retrieves the repository data (this is needed for the API request)
4. Reads the Pull Request template contents from `~/.kraken/pr-template.md`
5. Parses the pull request template contents with the release data
6. Writes all the release data to another file in `~/.kraken/temp` (this one will be prefixed with `release-`)
7. Finally it makes the request to the GitHub Rest API to create the PR.

If you now open GitHub and view your repo's Pull Requests, you should now see a new Pull Request ready and waiting to be reviewed! 🎉


## The Pull Request Template
When creating the Release Pull Request, it's very common to include some data about each of the issues that are going to be released. I personally at least want to list out the issue keys and/or names when using Jira, of I'm using GitHub as my Project Management tool, to link or resolve issues. And depending on how many issues are included in the release, this can be pretty time consuming. That's why I added the `~/.kraken/pr-template.json` file. In this file you can use markdown to create a template that will be automatically updated with the release data when the `kraken release` command is executed.

In addition to supporting your standard markdown, I've added some extra helpers so your release data can be placed exactly where you want it within the template contents before it gets written to the Pull Request.

### `{each} ... {end:each}`
If you want to include some information for each commit being released, add the content between `{each}` and `{end:each}` directives. Kraken will then iterate over every commit, update the contents with that commit's information, and then add the content to the body of the pull request. 

Within each iteration, you also have access to a few additional directives to specify which data you want to include:

- `{key}` - the key (or keyOverride) that was used to match to this commit
- `{hash}` - the git commit hash of the commit
- `{message}` - the git commit message

If this all sounds confusing, perhaps and example will help.

Let's say we want to include at table that lists out each commit's information. Our template might look something like this:

```
| key | hash | message |
| :-- | :-- | :-- |
{each}
| {key} | {hash} | {message} |
{end:each}
```

With this template, Kraken would create a table that looks like this within the body of the Pull Request:

| key | hash | message |
| :-- | :-- | :-- |
| DEV-1001 | 48a2300 | refactor: DEV-1001 - updated something |
| DEV-1003 | 67r8325 | fix: DEV-1003 - fixed something
| DEV-1009 | 72b1482 | feat: DEV-1009 - added a new feature

If there is more information you would like to be able to add to your pull requests, feel free to submit a [GitHub Issue](https://github.com/iamthe-Wraith/kraken/issues) outlining what would help you!


## Uses
- [Jira Rest API v3](https://developer.atlassian.com/cloud/jira/platform/rest/v3/intro/#about)
- [GitHub Rest API](https://docs.github.com/en/rest?apiVersion=2022-11-28)
