# Add Missing Snapshots (Zotero plugin)

Adds an **Add Missing Snapshots** command to Zotero's item context menu. It saves a
page snapshot for every selected item that has a URL but no snapshot yet.

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

MIT. See [LICENSE](LICENSE).
