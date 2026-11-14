# Site Author release records

The static records the publisher signs for a kit release, and the tests that hold them to the kit and to the base connector that verifies them. Nothing here is distributed in the kit, and nothing here is signed.

| File | What it is |
|------|------------|
| `pages-contract.json` | Current kit Pages contract source: the release, layout, approved worker fingerprint and record field names. Unsigned and not installed in any envelope |
| `pages-contract-0.1.0.json` | Legacy 0.1.0 static-only contract source: exact identity and layout, with worker/data/record all null and the reserved Function directory forbidden. Unsigned and not installed in any envelope |
| `pages-layouts.json` | The publisher's layout catalog source: every release layout this publisher has published, which the base connector's foreign Pages routes refuse and whose listing `cloudflare.pages.deploy` requires. Unsigned and unpublished |
| `tests/pages-contract.test.mjs` | The real-layout checks: contract against the kit, the catalog against the connector's own schema, the unmarked legacy layout refused on both foreign routes, and the real-layout deploy reaching a fake provider |

## The catalog keeps every layout

Each entry protects one published layout from the base connector's static and Functions routes, whether or not its output still carries a payload marker. An entry is never removed: removing one would let that layout's output be deployed without its release gate. A new layout is added to `pages-layouts.json`, and the catalog signed and published, before any contract using that layout is published, because `cloudflare.pages.deploy` refuses a contract whose layout its publisher's catalog does not list.

## Release pairs and member staging

The publisher distributes the approved public pair for version `<version>` at `https://releases.wisermemory.com/pages/wiser/<version>/pages-contract.json` and `https://releases.wisermemory.com/pages/wiser/<version>/pages-contract.sig`. The current supported versions are `0.5.0` and the static-only legacy `0.1.0`. Use the exact installed kit version; an absent or invalid pair is unavailable, never a reason to borrow another version. `https://releases.wisermemory.com/pages/wiser/layouts.json` and `layouts.sig` are the independent catalog addresses in the base connector's publisher trust, not caller-selected locations.

Only the approved publisher signing step produces release proofs. The current contract is paired with `pages-contract.sig`; the legacy static contract is paired with `pages-contract-0.1.0.sig`. Those signatures do not exist in this prototype. After release, Cloudflare Pages selects the pair matching the site's exact `kitVersion` and stages its unchanged bytes as `site/pages-contract.json` and `site/pages-contract.sig`, outside the upload directories and before the exact-build gate. The base connector verifies its independent publisher trust and every publisher's online catalog before any Cloudflare call. Neither an unsigned source nor a different version's pair can substitute. Static-only approval never admits a Function. The current Function-capable source still permits a static build with no optional Function.

The repository-source unsigned/uninstalled guard remains true: signatures are published separately, never placed into the kit or treated as member-created proofs. Release acceptance additionally verifies the actual public contract/signature pair and catalog against the independent trusted key. The source guard alone is never reported as production verification. Production signature, distribution/staging and live publication evidence remain owed until those checks run.

## Running the tests

The tests need the base connector's directory, named explicitly. No path to it is written in this tree. From this repository's root:

```sh
WISER_CLOUDFLARE_CONNECTOR=/absolute/path/to/wiser/connectors/cloudflare \
  node --test "skills/Site Author/release/tests/pages-contract.test.mjs"
```

Without `WISER_CLOUDFLARE_CONNECTOR` the tests that need the connector fail with a message naming the variable; that is a missing prerequisite, not a pass or a skip.

Every signature in these tests is made with a fixture Ed25519 key generated in memory and trusted only by a temporary copy of the connector. Every publisher download is served by a fake, so the tests make no network call. A pass says the records agree with the kit and the verifier. It says nothing about a production signature. Signing the contract and installing it, and signing and publishing the catalog at the URLs the connector's `pages-trust.json` names, are separate release steps, each approved on its own.
