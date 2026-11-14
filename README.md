# DevOps

A WISER plugin for people who run their own servers, self-hosted applications and websites: virtual machines, Docker workloads, light security, application setup, and building and publishing sites.

It ships three experts, DevOps Expert, CRM Expert and Site Publisher; eleven skills, Prepare VM, VM Inventory, VM Configure, VM Security Audit, Deploy Workload, Deploy Twenty, Back Up Twenty, Set Up Twenty Workspace, Site Author, Cloudflare Pages and Vercel Deploy; and three tools, vm-job, twenty-relay and pages-functions.

## Install

Install Wiser first, by its [Install steps](https://github.com/wisermethod/wiser#install): this plugin loads beside it. Then add this plugin in the same app:

- **Claude Cowork.** Open Customize, then Plugins, then Add marketplace. Give it `https://github.com/wisermethod/devops`, and install `devops`. Then turn on Sync automatically for this marketplace, as Wiser's steps do for theirs.
- **Claude Code.** Run `claude plugin marketplace add wisermethod/devops`, then `claude plugin install devops@wiser-method-devops`, and start Claude Code in your working folder.
- **Codex.** Add `wisermethod/devops` as a marketplace and install `devops`.
- **ChatGPT for desktop.** Add `wisermethod/devops` as a marketplace and install `devops`.
- **Grok.** Run `grok plugin marketplace add wisermethod/devops`, then `grok plugin install devops --trust`.
- **Cursor.** Add your clone of this repository as a workspace root beside your clone of Wiser and your working folder.

Work lands in the working folder you attach, never in this repository.
