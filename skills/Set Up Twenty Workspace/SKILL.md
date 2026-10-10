---
name: Set Up Twenty Workspace
type: skill
category: crm
description: Set up one organisation's workspace on a Twenty install Deploy Twenty made, its address, admin, members and roles, pipeline, fields and objects, each member's mailbox, a shared inbox and branded email from the organisation's own domain, and a first import judged by CRM Expert, adopting the install's first workspace when it is the organisation's, and report what was set up and what each person still does.
version: 0.1.0
gaps:
  - connecting Google or Microsoft mailboxes, which needs an OAuth client and the provider's approval
  - taking an organisation off the install
  - exporting an organisation's workspace
  - a mail host on a private network, which needs the install's allow-list
---

# Set Up Twenty Workspace

## Context

Use when one organisation's workspace should be set up on one Twenty install `skills/Deploy Twenty/` made: the workspace, its routes and its address; its admin, members and roles; the pipeline, fields and objects; each member's mailbox, guided; a shared inbox and branded email from the organisation's own domain; and the first import, judged. One run is one organisation on one install. The release is the release that install runs, Twenty v2.45.6. Adopting the install's first workspace, when that workspace is the organisation's, is this skill.

Not for installing, changing, or routing the install, and not for removing it or taking it offline. `skills/Deploy Twenty/` owns that. This skill names that skill's Job 2, `Job 2. Add or remove one hostname on an install this skill made`, for each hostname, and sequences it under `experts/DevOps Expert/`'s gate. Not for publishing a DNS record. That is `experts/IT Expert/` Job 1 in `wiser`, which sequences `skills/Zone Publisher/`, and each record is approved by name. Not for making an account, a key, a password, or an OAuth client. Those are the person's. Not for connecting Google or Microsoft mailboxes. That is missing: connecting Google or Microsoft mailboxes, which needs an OAuth client and the provider's approval. Not for taking an organisation off the install. That is missing: taking an organisation off the install. Not for exporting a workspace. That is missing: exporting an organisation's workspace. Not for a mail host on a private network, which needs the install's allow-list. That is missing. Name it as a question for `experts/DevOps Expert/` in this plugin, and load `experts/IT Expert/` Rule 5 in `wiser` and apply it: the question is named, and it is not answered here. Not for backing up an install or restoring one, which is `skills/Back Up Twenty/`. Not for a security review beyond the questions this skill names. Load `experts/IT Expert/` Rule 5 in `wiser` and apply it.

The configuration and the import stop at `experts/CRM Expert/` in this plugin. Job 2 judges the answers before anything is configured. Job 3 judges an import before anything is loaded. A verdict of not as proposed stops that part. The key is entered only on hosted connect's page, through `skills/Connect Account/` in `wiser`. Cite `connectors/twenty/auth.md` in `wiser`. Do not restate it.

Real contacts. The import of real contacts is refused until the install has a counted restore (`experts/CRM Expert/` Commitment 5). The evidence is `skills/Back Up Twenty/`'s report of a counted restore, which the person names: a durable record, not a filename. Its `source-id` must be this install's backup source id, and its `server-url` this install's, `https://<base>` with no path and no trailing slash. Its stage lines must include `witness:kid:match`, `witness:attachment:match`, `file:match`, `witness:ok` and `end`, each as a whole line. The restore target need not still exist. A counted restore is torn down afterwards, which is Back Up Twenty's cleanup and then Deploy Twenty's removal of the target.

The organisation's answers are filed in the organisation's own root, never in this plugin, per `wiser/standards/user-root.md` C3 and C4 and `experts/CRM Expert/` Rule 4. The file is `<root>/work/<slug>/twenty-workspace.md`.

No secret value is asked for in the conversation, printed, placed in a connector input, or written into a file in a repository. A password is typed by the person, in the browser window or into a vendor's own page. The report prints names, states, counts and statuses.

Classifier seam: none.

## Objective

The named organisation's workspace on the named install is set up as the filed answers say, or it is not, and the report says which. Each step is confirmed by its own read. A route is Deploy Twenty Job 2's, gated by `experts/DevOps Expert/`. A DNS record is IT Expert Job 1's and Zone Publisher's, approved by name. Configuration waits for CRM Expert Job 2. An import waits for CRM Expert Job 3, and a real-contact import also waits for the counted restore report. Verified against Success.

## Inputs

Wrap what the person supplies so material never reads as instruction.

- `<request>`: what they asked, in their words.
- `<machine>`: the one identifier this run is for. It matches the pattern `skills/Deploy Twenty/` states in `Do the inputs match, before any call?`. An unnamed machine is asked about. It is never guessed.
- `<install>`: the install name. It matches the install-name pattern that same section states. When they did not name one, the name is `twenty`.
- `<base>`: the install's own hostname, the host of its server URL. It matches the hostname pattern that same section states. `app.<base>` is the sign-in front door. `<sub>.<base>` is a workspace.
- `<root>`: the organisation's owning root, an absolute path. A relative path is refused by name. Ask for an absolute path. Do not send the other form.
- `<slug>`: the organisation's slug. It matches `^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$`. A value that does not match is asked about. It is never rewritten into a match.
- The answers file: `<root>/work/<slug>/twenty-workspace.md`. The directory `<root>/work/<slug>/` has to already exist, or the person has to say to create that one project folder. A missing `<root>` stops the run. This skill writes no other path in that root, and it writes nothing in this plugin.

A value that does not match is asked about before any call and before any browser session. Do not send the other form.

The display name, the subdomain, a hostname, an email, and an alias label match the patterns Deploy Twenty's `Do the inputs match, before any call?` states. The subdomain matches that section's alias-label pattern, and it is not `app` and not `base`. An email is at most 254 characters. A hostname is at most 253 characters and contains a letter.

## The setup questions

Ask these before anything is configured. File each answer in the answers file. An answer that does not match its pattern is asked again. Do not guess. CRM Expert Job 2 judges the filed answers. A verdict of not as proposed stops configuration. Sound with named changes: file the changes and ask Job 2 again. Do not configure on the old verdict.

1. **The organisation.** Its display name and its workspace subdomain. The default display name is the organisation's name as the person stated it, when that name matches Deploy Twenty's display-name pattern. When it does not, ask. Do not trim it into a match. The default subdomain is derived from the display name that matched: lower-case it; replace every run of characters outside `a-z` and `0-9` with one hyphen; remove hyphens from both ends; if it is longer than 16 characters, cut it to 16 and remove hyphens from the end. The result has to match the alias-label pattern and it is not `app` and not `base`. Otherwise ask. Do not invent a different label.
2. **Its address.** A hostname in the organisation's own zone. The default is `crm.` followed by the organisation's domain. Ask the domain when it was not named. Do not guess it. Refuse the address by name when any of these is true. The zone is the install's Cloudflare for SaaS zone, whose zone id the person gave Deploy Twenty in `<cloudflare_saas>`: the address equals that zone's name or ends with a dot followed by it. Ask the zone's name when it is not filed. Do not guess it. A DNS-only CNAME inside that zone is flattened to the origin's address and bypasses the edge. The zone is not one the person can publish through `skills/Zone Publisher/` in `wiser`. Ask which zone. No zone they can publish: stop the address. Do not pick another. The address equals `<base>`, or it ends with a dot followed by `<base>`. An address under the install's base collides with a workspace subdomain.
3. **Its shared inbox and branded address.** One address in the organisation's own domain. The default is `team@` followed by that domain. The address matches Deploy Twenty's email pattern. Twenty makes the emailing domain from this address's domain. Resend's records for a domain sit at the names Twenty's settings screen shows, `send.` and `resend._domainkey.` among them, and they leave the domain's existing MX alone. IT Expert checks that. An address whose domain is the install's Cloudflare for SaaS zone, or which sits under it, is refused by name. That zone is the install's, not the organisation's.
4. **Its admin.** A member by email. They are not the install's server admin unless the organisation says so. The server admin is the email Deploy Twenty's report names. On a fresh workspace the default is a different person: ask for the admin's email, and if the person names the server admin's email, ask whether the organisation says so. No: ask for a different email. Yes: file that the organisation said so. On every workspace this skill sets up, the server admin is already its first member and an Admin: they created it in step 3, or Deploy Twenty's first contact did on an adoption. Whether the server admin stays a member is asked here. The default is that they stay, named in the report, until a run on a scratch install proves that removing them leaves the server admin able to sign in at `app.<base>` and create a workspace. After that proof, the default becomes removal by the organisation's admin, once that admin's own Admin sign-in is confirmed. The proof is filed only when the answers file already holds the line `server-admin-removal: proved`. Until that line is present, the default in force is that they stay.
5. **Its members and roles.** Each member's email and role. The default is that the admin is Admin and everyone else is Member. A wider role needs a named reason (`experts/CRM Expert/` Commitment 4). A role the members screen does not offer is asked about. Do not invent a role.
6. **Its pipeline.** Each stage, the decision it records, and who moves a record out of it (`experts/CRM Expert/` Commitment 1). The default is Twenty's standard stages, the ones a new workspace already holds. This skill does not add stages when the answer is the default. It reads them and files the labels the read returned.
7. **Its fields and objects.** Each with its use (`experts/CRM Expert/` Job 2). The default is none.
8. **Its mailboxes.** Per member, filed before that member's mailbox is touched. Whether their mail host is public. Whether it needs an app password. Whether IMAP and SMTP are on. A host that is not public is not set up here. It is named as a question for `experts/DevOps Expert/`, and `experts/IT Expert/` Rule 5 in `wiser` is named with it, because the install refuses an outbound connection to a private address unless that host is named in `OUTBOUND_HTTP_ALLOWED_INTERNAL_HOSTS`. This skill does not set that variable. That is missing: a mail host on a private network, which needs the install's allow-list. When the host needs an app password, the member makes one at the host, and it is typed only into Twenty's screen. When IMAP or SMTP is off, that member's mailbox is not entered. The member turns them on at the host. SMTP submission is usually port 587 with STARTTLS, or port 465 with SSL. Mail sent through the member's own SMTP goes out under their own address, so nothing is added to DNS for this route. A Google or Microsoft mailbox is not asked into existence. Stop that member. Name the gap: connecting Google or Microsoft mailboxes, which needs an OAuth client and the provider's approval.
9. **Its first import.** The source, the columns and the count (`experts/CRM Expert/` Rule 5). The default is none. Ask whether the rows are real contacts. Yes: the counted-restore gate above applies, and a missing report stops the import. No: the rows are a sample, Job 3 still judges them, and the report says no real contacts were loaded. Unanswered: ask. Do not load.

## Steps

### Which part is this?

Take the first match.

- The request asks to install Twenty, to change the install, to remove it, or to take it offline or bring it online, and asks for no workspace. Hand it to `skills/Deploy Twenty/`. Stop.
- The request asks for one of those and also for a workspace. Hand only that part to `skills/Deploy Twenty/`. Ask this question again of what remains.
- The request asks for a hostname, a DNS record, or a zone, and asks for no workspace. Hand it to `experts/IT Expert/` Job 1 in `wiser`, which sequences `skills/Zone Publisher/`. Stop.
- The request asks to connect a Google or Microsoft mailbox, and asks for nothing else. Stop. Name the gap: connecting Google or Microsoft mailboxes, which needs an OAuth client and the provider's approval. Send nothing.
- The request asks to connect one of those and also asks for a workspace. Stop that part and name that gap. Ask this question again of what remains.
- The request asks to take the organisation off the install, or to export its workspace, and asks for nothing else. Stop. Name the gap for taking an organisation off the install, or the gap for exporting an organisation's workspace, in those words. Send nothing.
- The request asks for one of those and also asks for a workspace. Stop that part and name that gap. Ask this question again of what remains.
- The request is a mail host on a private network, and nothing else. Name the gap for a mail host on a private network, which needs the install's allow-list. Hand the question to `experts/DevOps Expert/`. Name `experts/IT Expert/` Rule 5 in `wiser`. Do not set the host up. Stop.
- The answers file holds a `step <n>:` line for this organisation. A rerun. Read every filed state before any step. A step 2 or step 3 filed `complete` with `note: adopted` stays an adoption. Do not create a second workspace.
- The organisation's subdomain is the subdomain `skills/Deploy Twenty/`'s report names as this install's first workspace. That report is the one its `What does the report say?` carries. The adoption. The adoption reads still have to agree. A read that does not agree stops. It is not a fresh setup.
- The install, the organisation and the subdomain can be read, and none of the above matched. A fresh setup.
- The part cannot be read. Ask. Do not guess. Do not call.

### What may this run call?

The machine question, the map, the health, the role, and the approval questions are Deploy Twenty's (`skills/Deploy Twenty/`): `Which machine is this run for?`, `What did vm.inventory.list_hosts answer?`, `Is this machine on the map?`, `Does this health answer get retried?`, `Which health class is the latest answer?`, `What did the second list_hosts show?`, `What is the role?`, and `Did a call stop for approval?`. Apply them before any call on the machine. The role question stops the router host before any such call. A fleet member continues.

This skill's own calls on the machine are the adoption read and, before a custom domain's save, the same read to list the aliases the install carries, and no other. It does not post a route, attach an alias, or write a file on the machine. A hostname route is `skills/Deploy Twenty/` Job 2, handed the machine, the install, the hostname, the alias label, the word `add` or the word `remove`, and `<live_state>` when this run has one. That hand-off carries no secret. Deploy Twenty gates that plan with `experts/DevOps Expert/` before any change call. This skill does not send Job 2's calls.

A connector call is by action id, under The connector. A public read is the one curl under The public read, from the person's own machine, not through the router. A signed-in step is Browser Control, or the fallback by hand.

### The ten steps

Take the steps in order. A rerun applies Each step's state before the step's mechanism. A step filed `complete` is not done again. Its read is not repeated unless the step says a rerun re-reads it.

1. **Questions, then CRM Expert Job 2.** Ask The setup questions and file them. Hand the filed answers to `experts/CRM Expert/` Job 2. Confirmed by that verdict. Not as proposed: stop. Do not start step 2.
2. **The workspace's route.** Before the workspace is created, so Twenty's redirect lands. Hand `skills/Deploy Twenty/` Job 2 the hostname `<subdomain>.<base>` and the alias label `<subdomain>`, with the word `add`. Confirmed by Job 2's own outcome, the route posted. Skipped on an adoption, whose route Deploy Twenty's first contact already added. On an adoption the adoption read confirms it, and the step is filed `complete` with `note: adopted`.
3. **The workspace.** The install's server admin, signed in, creates it with the display name and the subdomain. Creating a workspace needs the server admin. Confirmed by the public read for `https://<subdomain>.<base>` answering that display name. Skipped on an adoption, filed `complete` with `note: adopted` and the read that confirmed it.
4. **Admin, members, roles, invite link.** First the bootstrap, the server admin's only step after creation: in the server admin's own profile, the server admin invites the organisation's admin from Settings, Members. The organisation's admin accepts in their own profile, the server admin gives them the Admin role, and the organisation's admin's identity read (Browser Control) then shows their email in this workspace with the Admin role. That read is filed as `admin-signin: proved`. When question 4 filed that the server admin is the organisation's admin, the invitation and the role grant are skipped, and nothing else is: that person signs in through the `admin` profile, and the same identity read, showing their email in this workspace with the Admin role, is filed as `admin-signin: proved`. Then the organisation's admin invites the other members from Settings, Members. Invitations go out as team email, from the install's address. Roles are then assigned. The public invite link is turned off unless question 4's filed decision is to leave it on. Confirmed by Browser Control's read of the members screen and the settings screen: each filed email, each filed role, and the link's state. The connector is not used for members.
5. **API key and connect.** The workspace admin makes the key in Settings, APIs, and enters it only on hosted connect's page through `skills/Connect Account/` in `wiser`. Confirmed by both modules' `workspace` read answering this workspace's id and subdomain. A mismatch on either module stops every connector call.
6. **Fields, objects, stages.** `twenty.metadata.create_object`, `twenty.metadata.create_field` and `twenty.metadata.add_field_options`, each confirmed, confirmation `always`. A rename or a retirement is done in the settings screen, in CRM Expert's clearing shape: add the new option, move the records, then retire the old one. Confirmed by `twenty.metadata.list_objects`.
7. **Custom domain.** The custom domain section. Confirmed by the four reads that section names, the public read among them.
8. **Shared inbox and branded email.** That section. `complete` only when all four hold: Twenty shows the domain verified, the person says the forward is in place, and both proofs in that section's last item were made. Anything less is `partial`, and the report lists what remains.
9. **Mailboxes.** Each member enters their own details in Settings, Accounts, in their own `member-` profile, after the identity read shows that member's email in this workspace. Confirmed by Browser Control's read of that member's Accounts screen showing the intended handle and its sync status, then one message sent from that mailbox that arrives. The password is typed by the member, on that screen, and nowhere else.
10. **CRM Expert Job 3, then the import.** Job 3 first. Not as proposed stops the import. Sound with named changes: file the organisation's answers to the listed questions and ask Job 3 again. Do not import on that verdict. Submit only on sound as proposed. The admin runs the workspace's CSV import only after the import is filed `unknown`. Confirmed by `twenty.records.count` per object, before and after. The count is a number, never a row. Counts are not a certificate of mapping or deduplication. Job 3's verdict is.

### The server admin and the organisation admin

The install's server admin does two things: creates the workspace, and bootstraps the organisation's admin in step 4 (the invitation and the Admin role). Every later signed-in step is done by the organisation's admin, in that admin's own profile, and only after `admin-signin: proved` is filed, with one exception. In step 9 each member enters their own mailbox in their own `member-` profile, after the identity read shows that member's email in this workspace. A run on a scratch install is what proves a non-server-admin admin can do those later steps. Until that run has, the report says the proof is still open. A later step that the admin's sign-in cannot open stops that step. Do not hand it back to the server admin.

Saving a custom domain spends the install operator's Cloudflare grant. Twenty creates the custom hostname with the install's own token. The save waits for the operator's approval by name. That holds even when the organisation's admin is the one who presses the button.

### Browser Control

`tools/Browser Control/` in `wiser` drives the non-secret signed-in steps. It runs its own Chromium. Sign-in is the person's. Every password is typed by them, in that window. This skill never passes a password to the tool.

One profile per owning root, per organisation and per actor, outside every repository:

`$HOME/.wiser-browser-profiles/twenty-<install>-<site>-<root>-<slug>-<actor>`

`<site>` is the first 8 hexadecimal digits of the SHA-256 of `<base>`, so two installs with the same install name never share a profile. `<root>` is the first 12 hexadecimal digits of the SHA-256 of the owning root's absolute path, UTF-8, with no trailing newline. Two roots that hold an organisation with the same slug then do not share a profile. `<actor>` is `server-admin`, `admin`, or `member-` followed by the first 8 hexadecimal digits of the SHA-256 of that member's email after the email is lower-cased, the same encoding. The server admin's sign-in never reaches the organisation admin's steps, and no member's sign-in reaches another's. The same person who holds two of those roles still has one profile per role.

`$HOME` unset: stop. Do not pick another directory. A digest that cannot be computed: stop. Do not share a profile across actors.

The digest is the first field of this command, run on the person's own machine with the variable `text` set to `<base>`, the absolute path, or the lower-cased email. The profile component is the first 8 digits of that field for `<site>`, the first 12 for `<root>`, and the first 8 for a member.

```sh
if command -v sha256sum >/dev/null 2>&1; then
  printf '%s' "$text" | sha256sum
else
  printf '%s' "$text" | shasum -a 256
fi
```

Start the session with that tool's `session start` and `--profile` set to the absolute path. Do not omit `--profile`.

The signed-in identity is read first, and again before every change in the browser. Read three things from that profile's window: the signed-in user's email on its own settings screen; the page's host, which is the workspace's own hostname, `<subdomain>.<base>` or the custom address once step 7 is complete; and the workspace's name on its general settings screen, which is the filed current name. The answers file holds `current-name: <name>`, the name the last public read confirmed, separately from the display name the organisation asked for. Step 3's public read files it on a fresh workspace, and the adoption's public read files Deploy Twenty's name on an adoption. Continue only when all three are this actor's and this workspace's. A user can belong to more than one workspace, so the email alone is not the workspace. Step 3's creation is the one exception: its host is `app.<base>` and no workspace exists yet, so only the email is read, and it is the server admin's. Any other email, host or name, or none, stops that actor's steps. The person signs out and signs in as the actor, and the read is repeated. Do not continue on a second try that still does not match.

A profile holds a signed-in session. The report names each profile the run used, and says that removing a profile signs that actor out on this machine. Removing one is the person's choice. This skill does not delete a profile.

No click is evidence. A returned click does not file a step `complete`. The step's own read does.

The fallback is by hand. When Browser Control cannot take the step, the person does it from the menu path that step names, in the same profile's window, and the same read confirms it. A step with no read is not done.

### Adopting the install's first workspace

Deploy Twenty's first contact already made one workspace: the server admin signed up, the workspace was created with the display name and subdomain Deploy Twenty was given, and its route `<install>-<subdomain>` was posted. Steps 2 and 3 would add a route Job 2 refuses as existing, then create a second workspace. When the organisation's subdomain is the one Deploy Twenty's report names as the first workspace, adopt that workspace instead. Only the first workspace is adopted, and only when every read below agrees. Any other existing workspace with the organisation's subdomain stops the run as a conflict for the person. Do not adopt it and do not create another.

The read is Deploy Twenty's own read of the install, the one its first-contact classification uses. Send the later read in `What does the first-contact call do?` (`skills/Deploy Twenty/`), the script that section gives, unchanged, as one `vm.command.run`. The person is told the call is a read. Do not copy the script into this run's own words, and do not send the first-contact call. Classify the state file, the password file and the config by that later-read question's own bullets, and by nothing else. That read prints no routes body, so `What did the config and the routes show?` is not applied to it. The route check below is made against the config that read printed.

Adoption needs all of these.

- The state holds `workspace:ok`, and the password file is absent. `process:running`: do not adopt. That section says the state is not settled. Stop.
- The config read succeeded, as the later-read question judges it, and holds the generated workspace route for `<subdomain>.<base>` with the alias `<install>-<subdomain>`: the exact generated route object that question names for the workspace hostname.
- The public read for `https://<subdomain>.<base>` answers the display name Deploy Twenty's report names.

A route the read finds missing, or that is present and is not that generated object, is Deploy Twenty's to repair: its `routes-only` plan, gated again. It is not repaired here. Any other mismatch stops. A public read whose display name is not the name Deploy Twenty's report names stops. That workspace is not the first one the report named.

File steps 2 and 3 `complete`, each with `note: adopted` and the read that confirmed it. Continue from step 4 with the organisation's admin. The server admin's membership is question 4.

When the organisation's display name differs from the name Deploy Twenty was given, the organisation's admin changes it in settings, after step 4's admin exists. Until then, the identity read compares against `current-name`, which is Deploy Twenty's name. The public read confirms the new name, and only then is `current-name` filed as the new name. That change is not the adoption read. The adoption read still had to match Deploy Twenty's name.

### The custom domain

1. The alias label, before anything else. Derive it from the address: the first label, lower-cased, cut to 16 characters and then trimmed of a trailing hyphen. Send the same read the adoption sends, and list every alias the printed config's routes dial, the name before `:3000`. The label is refused when it is `app` or `base`, when it does not match Deploy Twenty's alias-label pattern, or when `<install>-<label>` is already one of those aliases. Two organisations at `crm.` addresses derive the same label. A refused label is asked about: the person names a unique label, which is filed as `alias: <label>`. Do not invent one. No label filed: stop the custom domain before the save.
2. The operator's approval by name, before the save. Twenty creates the hostname with the install's Cloudflare token. The token-reach question stays named and is not answered: that token has Zone, SSL and Certificates, Edit on the SaaS zone, and how far it reaches over that zone's SSL settings and certificates is not judged here. `experts/IT Expert/` Rule 5 in `wiser` is the rule. No approval by name: do not save. Stop the custom domain.
3. The organisation's admin saves the address in settings, through Browser Control, or by hand from that same settings screen. The button is not the approval. The operator's approval is.
4. The delegation target is read from the settings screen's status, Twenty's check of the custom domain's records. A target the screen does not show is not invented.
5. The two records go through `experts/IT Expert/` Job 1 and `skills/Zone Publisher/` in `wiser`, each approved by name. A DNS-only CNAME from the address to the fallback origin, read from the deployment record the person names: the proxied record pointing at the machine that Deploy Twenty's Cloudflare for SaaS question had them confirm. It is never the `app.<base>` target Twenty's screen suggests. A record pointed there is served past Cloudflare's edge. The deployment record names no origin: stop. Do not publish the suggested target. And a DNS-only CNAME at `_acme-challenge.<address>` to the target the settings screen showed. IT Expert checks that neither record is the domain's MX.
6. `skills/Deploy Twenty/` Job 2 adds the address's route, under DevOps Expert's gate, with the word `add` and the filed alias label from item 1.
7. Done when all four of these hold. The zone's own nameservers answer both CNAMEs. The settings status shows the hostname and its certificate active. `https://<address>/` through Cloudflare's edge serves the workspace: one curl on the person's machine, no `--resolve` and no `-k`, `curl -sS -o /dev/null -w '%{http_code}\n' --max-time 20 https://<address>/`, exit 0 and the code `200`. Any other result is not done. Do not pass it with `-k`. A lookup of the address that returns the machine's own address is the edge bypassed: stop, and do not call the domain done. The public read for `https://<address>` answers the display name.

A route Job 2 left partial, the alias attached and the route not posted, stops the run. Name Deploy Twenty's own recovery, a new gated plan. Do not repair it here. Do not remove the alias in this run.

### The shared inbox and branded email

This needs the inbound domain Deploy Twenty's report names. Deploy Twenty sets that domain when the driver is RESEND. A report that names no inbound domain, or names the driver LOG, stops this section. Do not create the channel. Without the domain, Twenty refuses the channel. The refusal recorded on v2.45.6 is "Email group is not configured on this server". Stop on that sentence. Stop also when Twenty says email handles are not configured. Do not try another way to make the domain.

1. The admin creates the email group channel with the address from question 3, in Settings, Accounts, through Browser Control. Twenty then makes the emailing domain for the address's domain, makes a connected account of provider `EMAIL_GROUP` with that address, and generates a forwarding address, `ch_<hex>@<inbound domain>`.
2. Read Resend's domain records and the forwarding address from the settings screens. A record or an address the screen does not show is not invented. The forwarding address is filed. It is not a secret. It is not a mailbox password.
3. Publish the records through `experts/IT Expert/` Job 1 and `skills/Zone Publisher/` in `wiser`, approved by name. They are the records the screen showed. They are verified in Twenty, and this step is done when Twenty shows the domain verified.
4. The organisation's own mail host forwards mail for the address to the generated `ch_<hex>@` address. That is the person's step at their mail host. It is how a reply reaches the shared inbox. The report names the address and says the forward is still theirs until they say it is in place.
5. The proofs this skill's run owes, and the report says whether this run made them. One branded message arrives from the address with SPF and DKIM passing, the headers read at the receiving mailbox. One message sent to the address arrives in the workspace's shared inbox. A proof not made is named, and the step is `partial`.

### Email, stated to the organisation

Twenty's three kinds, in plain words, filed in the answers and stated in the report.

- Team email comes from the install's address. Invitations and the other mail to members are this kind.
- Email to contacts comes from each person's own mailbox.
- Branded email comes from the organisation's verified domain, which is the shared inbox's address.

A design that expects team email from the organisation's domain, or a contact's email from the install's address, is CRM Expert Job 2's test for the wrong sender. This skill does not configure past a verdict of not as proposed.

### Each step's state, and a run that stops

Each step's outcome is filed in the answers file as one of four states.

- `absent`: not begun.
- `complete`: confirmed by its read.
- `partial`: begun and confirmed incomplete.
- `unknown`: an outcome that was not read.

The line is `step <n>: <state>`, then `read: <one line>` when a read confirmed it, and `note: adopted` on steps 2 and 3 when those steps were adopted. No other note is written.

A rerun reads these lines first. It continues an `absent` step and re-reads an `unknown` one. It acts on a `partial` one only in the cases below.

- Workspace, invitations, roles, and data-model writes: re-read, and do what is missing. Twenty refuses a duplicate name, and the read shows it. A create whose read already shows the object is not sent again.
- A route that Deploy Twenty Job 2 left partial, the alias attached and the route not posted: stop and name Deploy Twenty's own recovery, a new gated plan. Do not repair it here.
- The import. Its state is filed `unknown` before the admin submits it, with its source, its row count, and each object's `twenty.records.count` from before. Each submission is numbered from 1. The lines are `import <k>: unknown`, `source: <name>`, `rows: <count>`, and `count <object>: <number>` for each object. If those lines cannot be filed, nothing is submitted. After submission, the counts are read again and the step is filed `complete` or `partial` from the import's own result and those counts. A missing outcome after submission is filed `unknown`, never `absent`. An `unknown` or `partial` import is never submitted again automatically. It stops for the admin, who reads the import's own result in Twenty and reconciles it with CRM Expert Job 3. Only that reconciliation, filed as `import-reconciliation <k>: filed` for the latest submission `<k>`, admits submission `<k+1>`. A reconciliation of an earlier submission admits nothing.
- DNS records: `skills/Zone Publisher/`'s own re-read decides. This skill does not publish a record again on its own say-so.
- The shared inbox, step 8: re-read the channel, the forwarding address and the domain's verification on the settings screens. Do not create the channel again when the read shows it. Ask the person whether the forward is in place, and make whichever proof is missing. File `complete` only when all four of step 8's conditions hold.
- The custom domain, step 7: re-read the settings status. Do not save the address again when the status shows it. Continue from the first of that section's items whose read is not confirmed.

A run that stops files the step it stopped on as `partial` when the read showed it incomplete, and as `unknown` when the outcome was not read. It does not file `complete` for a step whose read did not confirm it.

### The connector

By action id only, through the gateway. Cite `connectors/twenty/CONNECTOR.md` in `wiser`. Do not restate its patterns. The skill never passes a key, a password, or a mailbox credential as an action's input. A value offered as one of those is not sent. A key pasted into the conversation is `skills/Connect Account/`'s compromised-key stop. Cite that skill's Inputs. Do not echo the key.

`twenty.records.workspace` and `twenty.metadata.workspace` are read before any write, and again before `twenty.records.count`. Each returns the bound key's `id`, `subdomain` and `displayName`. A mismatch on either module, against the public read's `id` or against the filed subdomain and display name, stops every connector call. Comparing the public read's `id` with both `workspace` reads is what ties the key to this workspace. One module naming a different workspace than the other is a mismatch. Stop. Do not write, and do not count.

`twenty.metadata.list_objects`, `twenty.metadata.create_object`, `twenty.metadata.create_field` and `twenty.metadata.add_field_options` are the data model. Each create and each add is confirmation `always`. After each one, `twenty.metadata.list_objects` has to show what was asked. Absent: the step is `partial`. Do not send the same create again when the list already shows it. Twenty refuses a duplicate name, and that read is the evidence.

`twenty.records.count` is the import's before and after. The input is the object name and nothing else. The answer is a number. An answer that carries a record stops the run. Do not repeat the call, and do not copy the record into the report or the answers file.

This skill does not call `twenty.records.list`, `twenty.records.create`, or a generic read of `workspaceMembers` or `connectedAccounts`. Members, roles and mailboxes are read from the settings screens.

`needs_connect` is `skills/Connect Account/` in `wiser`, for the module the answer names. `needs_confirmation` is the connector's own stop: repeat the identical call with `confirm: true` only after the person approves that stop. Any other status is named as the connector's Troubleshooting names it, and the write is not treated as done.

One workspace. Cite the connector's One workspace rule. A second workspace is a new connect of both modules, then both `workspace` reads, before any write.

### The public read

`getPublicWorkspaceDataByDomain(origin: $o) { id displayName workspaceUrls { subdomainUrl customUrl } }` is a public GraphQL query, under `PublicEndpointGuard`, in the same core resolver (`workspace.resolver.ts` at Twenty `6007ad5a`) as the `currentWorkspace` query the connector sends to `/metadata`. No key is sent. This is the endpoint this skill expects. No run has confirmed it yet, so an answer that is not GraphQL stops, as below.

The skill sends it from the person's own machine as one `curl` to `https://app.<base>/metadata`. `$o` is the workspace's origin, `https://<subdomain>.<base>` or `https://<address>`, with no path and no trailing slash. The time limit is 20 seconds. The command is this and no other:

```sh
curl -sS --max-time 20 -H 'Content-Type: application/json' --data-binary '{"query":"query($o:String!){getPublicWorkspaceDataByDomain(origin:$o){id displayName workspaceUrls{subdomainUrl customUrl}}}","variables":{"o":"https://<origin>"}}' 'https://app.<base>/metadata'
```

Read `displayName` and `id` from `data.getPublicWorkspaceDataByDomain`. Read `workspaceUrls` when the step compares a URL. This read confirms step 3, step 7, and the adoption. Its `id` is what the connector's `workspace` reads are compared with.

The body is not a confirming read when it is not JSON, when JSON has neither `data` nor `errors`, when `data.getPublicWorkspaceDataByDomain` is null or lacks a string `id` or `displayName` while no `errors` entry is present, or when the time limit kills the command. Stop. Report the curl's exit and that the answer was not GraphQL, or that it timed out. Do not try another path. When the only `errors` entry's message says the workspace was not found, that origin has no workspace: a fresh setup may create it after its route is posted, and an adoption stops. Any other `errors` entry, or more than one, stops the read. Do not send the query anywhere else.

## What does the report say?

One report. What was set up. Each step's filed state. Each profile the run used, by its path, and that removing a profile signs that actor out on this machine. Each person's remaining steps, and no step filed `complete` listed as remaining.

The remaining steps, when they were not done in the run:

- DNS records, through `experts/IT Expert/` Job 1 and `skills/Zone Publisher/` in `wiser`, each record still to be approved by name.
- The forward at the organisation's mail host, the shared address to the generated `ch_<hex>@` address.
- Each member's mailbox entry, for a member whose Accounts screen did not show the handle.
- Resend's settings, where the install still lacks them: receiving on the inbound domain, and the webhook, which are the person's with the vendor and which Deploy Twenty's report already names.

The custom-domain save names its cost and its wait. The cost is the install operator's Cloudflare grant: Twenty creates the custom hostname with the install's token. The save waits for the operator's approval by name, even when the organisation's admin presses the button. A save that did not receive that approval is reported as not done.

The report names the server admin's membership in the words question 4 filed, and whether `server-admin-removal: proved` is in the answers. It names the token-reach question without answering it. It states the three kinds of email. It names every gap that applies. It copies no key, no password, and no contact's details. An import is reported as its source, its row count, its state, and the counts.

A hand-off names its path. A route names Deploy Twenty Job 2 and DevOps Expert's gate. A DNS record names IT Expert Job 1 and Zone Publisher. A key names Connect Account. A verdict names CRM Expert Job 2 or Job 3. A private mail host names DevOps Expert and IT Expert Rule 5.

## Pitfalls

- **The request is ambiguous.** More than one organisation, more than one install, or a workspace with no organisation named. Ask before any call, any browser session, and any connector call.
- **An address in the SaaS zone, published anyway.** Refuse it by name. The zone is the one whose id the person gave Deploy Twenty in `<cloudflare_saas>`. A DNS-only CNAME inside that zone is flattened to the origin's address and bypasses the edge.
- **The suggested custom-domain target followed.** The CNAME goes to the fallback origin from the deployment record. It does not go to `app.<base>`. No named origin: stop. Do not publish the suggestion.
- **A custom-domain save without the operator's approval by name.** Do not save. The organisation's admin pressing the button is not that approval. The save spends the operator's Cloudflare grant.
- **The public read answered something other than GraphQL.** Stop. Report it. Do not try another path, and do not treat an HTML page or a proxy error as a workspace that is absent.
- **A click filed as a completed step.** No click is evidence. The step stays at the state its read supports.
- **The wrong actor or the wrong workspace in a profile.** The settings screen's email is not the actor's, the page's host is not this workspace's hostname, or the workspace's name is not the filed `current-name`. Stop that actor's steps. The person signs out and signs in as the actor, and the read is repeated.
- **Steps 2 and 3 run on the install's first workspace.** That creates a second workspace and asks Job 2 for a route it will refuse as existing. Adopt when the reads agree. Otherwise stop as a conflict.
- **A partial route repaired here.** Alias attached, route not posted. Stop. Name Deploy Twenty's own recovery, a new gated plan. Do not remove the alias and do not post the route from this skill.
- **A connector call after a workspace mismatch.** Either module's `workspace` read disagrees with the other, or with the public read's `id`, or with the filed name. Stop every connector call.
- **A key, a password, or a mailbox credential in an action's input or in the report.** Do not send it. A pasted key is Connect Account's compromised-key stop. The member types a mailbox password only into Twenty's screen.
- **`workspaceMembers` or `connectedAccounts` read through the connector.** Do not. Members and mailboxes are read from the settings screens.
- **Real contacts with no counted restore, or with another install's report.** The report's `source-id` is this install's, its `server-url` is `https://<base>`, and the stage lines include `witness:kid:match`, `witness:attachment:match`, `file:match`, `witness:ok` and `end`. Anything else refuses the import. The target need not still exist.
- **An import submitted before `unknown` was filed, or submitted again while `unknown` or `partial`.** Do not submit. Only a filed reconciliation of the latest submission, with CRM Expert Job 3, admits the next one.
- **A private mail host set up here.** Name the gap. Hand the question to DevOps Expert. Name IT Expert Rule 5. Do not set `OUTBOUND_HTTP_ALLOWED_INTERNAL_HOSTS`.
- **Google or Microsoft mail treated as IMAP.** Stop. Name the gap: connecting Google or Microsoft mailboxes, which needs an OAuth client and the provider's approval.

## Success

- The report covers one organisation and one install. A request that named more than one was asked, and nothing was called before the answer.
- Patterns were refused by name before any call. No key, password, or mailbox credential was a connector input, a printed line, or a report line.
- The answers were filed at `<root>/work/<slug>/twenty-workspace.md` and nowhere in this plugin.
- CRM Expert Job 2's verdict was in hand before anything was configured. Not as proposed stopped that part. Job 3's verdict was in hand before an import was submitted. Not as proposed stopped the import.
- A fresh workspace's route was handed to Deploy Twenty Job 2, under DevOps Expert's gate, before the workspace was created. An adoption did not add that route and did not create a second workspace. Steps 2 and 3 were filed `complete` with `note: adopted` only after the state, the route and the public read agreed.
- The server admin's signed-in steps were the workspace's creation and the organisation admin's bootstrap, and nothing later. Later signed-in steps were the organisation's admin's, after `admin-signin: proved`, each in that actor's profile. Before every change in the browser, the window showed that actor's email, this workspace's hostname and its filed `current-name`, except at step 3's creation, where the email alone was read. Each member's mailbox was entered in that member's own profile.
- No step was filed `complete` from a click. Each completed step names its read.
- Both `workspace` reads were taken before any connector write and before any count, and a mismatch stopped every connector call. `twenty.records.count` returned a number. No contact row was copied.
- A custom-domain save waited for the operator's approval by name, and the report names the Cloudflare grant that save spends. The address CNAME points at the fallback origin from the deployment record, not at `app.<base>`.
- A real-contact import was refused unless the named restore report matched this install's `source-id` and `server-url` and carried the five stage lines. The import was filed `unknown`, with its source, its row count and the counts from before, before it was submitted. An unknown or partial import was not submitted again without a filed reconciliation of that submission. Job 3's sound with named changes was answered and judged again before any import.
- DNS was handed to IT Expert Job 1 and Zone Publisher, each record approved by name. The key was entered through Connect Account. A private mail host was named to DevOps Expert with IT Expert Rule 5, and was not set up.
- The report names what was set up, each step's state, each profile used, and each person's remaining steps: DNS records, the forward, each member's mailbox entry, and Resend's settings where the install still lacks them.
