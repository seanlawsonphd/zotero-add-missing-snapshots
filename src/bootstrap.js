/* global Zotero, Services */

var AddMissingSnapshots;

function log(msg) {
	Zotero.debug(`Add Missing Snapshots: ${msg}`);
}

function install() {
	log('Installed');
}

async function startup({ id, version, rootURI }) {
	log(`Starting ${version}`);
	Services.scriptloader.loadSubScript(rootURI + 'add-missing-snapshots.js');
	AddMissingSnapshots.init({ id, version, rootURI });
	AddMissingSnapshots.addToAllWindows();
}

function onMainWindowLoad({ window }) {
	AddMissingSnapshots.addToWindow(window);
}

function onMainWindowUnload({ window }) {
	AddMissingSnapshots.removeFromWindow(window);
}

function shutdown() {
	log('Shutting down');
	AddMissingSnapshots.removeFromAllWindows();
	AddMissingSnapshots.unregisterMenu();
	AddMissingSnapshots = undefined;
}

function uninstall() {
	log('Uninstalled');
}
