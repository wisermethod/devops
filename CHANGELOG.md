# What changed in DevOps

## v2026.11.27, November 27, 2026

- Cloudflare Pages 0.9.2 publishes a site at kit 0.6.0, the release that added `LeadForm`. Its signed release pair has been served since November 20, but the skill still listed only 0.5.0 and 0.1.0 and stopped those publications.

## v2026.11.24.2, November 24, 2026

- Tart VM 0.2.1 asks once when you share two folders and say how each is shared, such as a whole drive read-only and one folder in it with changes allowed. It tells you what sharing each folder allows, then asks you to confirm both, as you asked.

## v2026.11.24, November 24, 2026

- Tart VM 0.2.0 keeps a base virtual Mac you set up yourself and copies it for each task. Ask for a base, and it opens the virtual Mac in a window on your screen so you can install apps and sign in by hand, then shuts it down properly so nothing you set up is lost. Each task works in a fresh copy of the base, with your apps and sign-ins, and deletes the copy when it is done, so your base stays as it is. It powers off or deletes your base only after you say yes and name it.
- Tart VM can share a folder from your Mac into the virtual Mac at the same path it has on your Mac, read-only or with changes allowed. It tells you first that anything running in the virtual Mac can read every file in the folder, and can change or delete them unless the share is read-only. It will not share a folder that holds the plugin, its own records or Tart's virtual machines. Proved on Tart 2.42.0.
- tart-vm 0.2.0 adds `--keep` to `create` and `clone`, `--window` and `--share <folder>[:ro]` to `start`, and `--kept-approved` for powering off or deleting a kept virtual machine. A kept one stops by asking macOS to shut down. A start that fails turns off what it opened, and `stop` no longer waits for a start in progress.

## v2026.11.23.2, November 23, 2026

- Tart VM 0.1.0 is new. Ask for a clean macOS virtual machine on your own Apple silicon Mac to test or automate something in, and it makes one from Tart's macOS image, works in it, and throws it away when you are done. It runs commands inside the virtual Mac, and when a task needs the screen it sees and uses the virtual Mac's screen without touching your own pointer, keyboard, clipboard or windows. It turns the screen connection on only for a task that needs it, and tells you first that the connection can be reached from the networks your Mac is on, with a password Tart makes as its only lock. It needs Tart, which it installs only on your yes, following Tart's own instructions, and it works in apps that can run commands on your Mac, such as Claude Code, Codex and Cursor. Proved on Tart 2.42.0.
- tart-vm 0.1.0 is the tool behind it. It makes, starts, stops and deletes the virtual machines it creates, deletes one it did not make only after DevOps Expert's check and your yes naming it, refuses a third running virtual Mac, and starts every one without a window on your Mac and without sharing your clipboard, audio or USB devices.
- DevOps Expert 0.8.0 places a throwaway virtual machine on your own Mac on Tart VM, and checks only the steps that reach past it: deleting a virtual machine Tart VM did not make, sharing a folder from your Mac into one, or bridged networking. A provider's or a fleet's machine is still set up by hand. Prepare VM and VM Inventory 0.1.3 point to Tart VM.

## v2026.11.23, November 23, 2026

- App People 0.2.0 is new. Ask Wiser to let one person sign in to a Wiser app, to stop letting one person sign in, or to compare the app's Cloudflare sign-in list with the app's People list. Before each change it names every address the sign-in list covers and asks you to confirm, and it reads the list back before it reports. It never removes the app's first owner or the last email on a list. It needs a Cloudflare connection that can edit Access, and the Cloudflare connector Wiser serves from `v2026.11.23.6`.
- DevOps Expert 0.7.6 checks each sign-in change App People makes before it is applied.

## v2026.11.21, November 21, 2026

- Site Author 0.13.1 refreshes the instructions of a site set up before November 14. Check and Refresh router stopped on two paragraphs the move to DevOps had written into those sites' instructions. Both are now recognized, and a paragraph edited further still stops for reconciliation.

## v2026.11.20, November 20, 2026

- Site Author 0.13.0 and site kit 0.6.0 add `LeadForm`, a contact form a kit site places with one line. It has six fields, a Send button and a Privacy link, runs no script, and posts to the intake address of your Wiser CRM install. Check refuses a form whose address does not end in `/submit`, whose privacy page is missing or unpublished, or whose privacy path a redirect takes a visitor away from, and tells an older site to Upgrade. The form's words are fixed, and it has no file upload or captcha.
- Site Author says what a site's privacy page must state before a form is published, and that the form works only from the site's own public address. Site Publisher 0.1.1 reads that page before publish, including when a form is added to a page that already exists.
- A site at kit 0.6.0 publishes to Cloudflare Pages with the 0.6.0 release pair.

## v2026.11.18, November 18, 2026

- Site Author 0.12.0 files Animated Explainer pictures whose motion follows scroll, pointer or entering view, checking the producer's placement facts, the built responses and finished still, and the page's script budget before filing.
- Site Author 0.11.0 refreshes recognized older envelope instructions for Site Publisher and release-proof staging, archiving the original first. Check reports stale instructions without writing; customized managed policy stops for reconciliation, while local text outside those sections stays unchanged.
- Cloudflare Pages 0.9.1 directs unsupported older kit versions through Upgrade and the matching public release pair. A bad signature on a supported version remains a publication stop.
- Site Author's release records distinguish unsigned repository sources from the public contracts, signatures and catalog already published, and document the connector's exact catalog pin and its update order.
- The license now names First Strategy LLC, which operates Wiser Memory, as the holder of DevOps, where it named EffectiveSC. It is Wiser Domain Plugin License 1.2; what you may and may not do is unchanged.

## v2026.11.14, November 14, 2026

Site Publisher joins DevOps with Site Author and its site kit, Cloudflare Pages, Vercel Deploy and pages-functions. Building and publishing a site follow one chain, with the same exact-build publish gate. The base Wiser plugin still provides site audits, search artifacts, account setup, DNS and the connectors. Existing site routers need their authoring and publish citations refreshed before the base release removes the old skills.

The kit also retains the X / Twitter social-card metadata released in Wiser v2026.11.14: the existing title, description and share image populate the card tags.
