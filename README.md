# Add Missing Snapshots (Zotero plugin)

Adds two commands to Zotero's item context menu:

- **Add Missing Snapshots** saves a page snapshot for every selected item that has a URL but
  no snapshot yet.
- **Create Reader View** turns each selected item's snapshot into a clean, readable copy
  (title, byline, date, and article text, without navigation, ads, or scripts) and saves it as a
  second attachment named "Reader view". The original snapshot is left untouched.

## Why

When you save several items at once from the Zotero Connector's pick-list, the
Connector skips snapshots on purpose
([zotero-connectors issue 481](https://github.com/zotero/zotero-connectors/issues/481)).
Single saves get a snapshot; multi-item saves do not. This plugin backfills them
afterwards, using Zotero's own hidden browser, so the result is the same SingleFile
snapshot the Connector would have made.

## Install

1. Download the latest `.xpi` from the [Releases](../../releases) page.
2. In Zotero, open **Tools → Plugins**, click the gear icon, choose
   **Install Plugin From File…**, and pick the `.xpi`.

Requires Zotero 7 or later (declared compatible through Zotero 10.x; compatibility is
extended via the update manifest). Updates arrive through Zotero's plugin updater.

## Use

Select one or more items, right-click, and choose **Add Missing Snapshots**.
A progress popup reports how many snapshots were added and lists any failures.

To get clean copies, select the items and choose **Create Reader View**. Each item's oldest
snapshot is run through [Mozilla's Readability](https://github.com/mozilla/readability), the
engine behind Firefox's Reader View, and the result is saved as a new "Reader view" attachment
that opens in Zotero's reader with full annotation support. Items that already have a reader view
or have no snapshot are skipped (run Add Missing Snapshots first). To regenerate a reader view,
delete the "Reader view" attachment and run the command again. Readability works well on news
articles; on cluttered pages it can drop captions, tables, or embedded media, so keep the original
snapshot for anything that matters.

Items are skipped when they already have a snapshot (an imported HTML attachment),
have no `http(s)` URL, are attachments or notes themselves, or live in a library
where files cannot be edited.

Sites that block automated access may refuse Zotero's hidden browser; those items
are reported as failed and can be saved individually with the Connector.

## Build from source

```bash
./build.sh
```

This writes `build/add-missing-snapshots-<version>.xpi` and prints its SHA-256,
which belongs in `updates.json` for automatic updates.

For development, run `./build.sh` after each change and reinstall the new `.xpi`
through **Tools → Plugins → Install Plugin From File…**; Zotero reloads the plugin
without a restart. Current Zotero releases no longer pick up unpacked plugins or
`.xpi` files placed in the profile's `extensions` folder.

## License

MIT. See [LICENSE](LICENSE). Bundles Mozilla's Readability (Apache License 2.0); see
`src/lib/LICENSE-Readability.txt`.
