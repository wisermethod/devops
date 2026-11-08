# DevOps

A WISER plugin for people who run their own servers and self-hosted applications: virtual machines, Docker workloads, light security, and setting up each organisation's use of applications such as Twenty CRM. It ships two experts, DevOps Expert and CRM Expert, eight skills, Prepare VM, VM Inventory, VM Configure, VM Security Audit, Deploy Workload, Deploy Twenty, Back Up Twenty and Set Up Twenty Workspace, and two tools, vm-job and twenty-relay.

## Install

Install Wiser first, by its [Install steps](https://github.com/wisermethod/wiser#install): this plugin loads beside it. Then add this plugin in the same app:

- **Claude Cowork.** Open Customize, then Plugins, then Add marketplace. Give it `https://github.com/wisermethod/devops`, and install `devops`. Then turn on Sync automatically for this marketplace, as Wiser's steps do for theirs.
- **Claude Code.** Run `claude plugin marketplace add wisermethod/devops`, then `claude plugin install devops@wiser-method-devops`, and start Claude Code in your working folder.
- **Codex.** Add `wisermethod/devops` as a marketplace and install `devops`.
- **ChatGPT for desktop.** Add `wisermethod/devops` as a marketplace and install `devops`.
- **Grok.** Run `grok plugin marketplace add wisermethod/devops`, then `grok plugin install devops --trust`.
- **Cursor.** Add your clone of this repository as a workspace root beside your clone of Wiser and your working folder.

Work lands in the working folder you attach, never in this repository.
