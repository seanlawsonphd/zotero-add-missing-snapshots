/* global Zotero */

AddMissingSnapshots = {
	id: null,
	version: null,
	rootURI: null,
	initialized: false,
	running: false,
	menuID: null,
	FTL_FILE: 'add-missing-snapshots.ftl',
	MENUITEM_ID: 'add-missing-snapshots-menuitem',
	MENU_L10N_ID: 'add-missing-snapshots-menuitem',

	init({ id, version, rootURI }) {
		if (this.initialized) return;
		this.id = id;
		this.version = version;
		this.rootURI = rootURI;
		this.initialized = true;
		this.registerMenu();
	},

	log(msg) {
		Zotero.debug(`Add Missing Snapshots: ${msg}`);
	},

	// Zotero 7.1 and later provide a menu API that covers every main window.
	// Zotero 7.0 gets a menu item inserted into each window instead.
	useMenuManager() {
		return !!(Zotero.MenuManager && Zotero.MenuManager.registerMenu);
	},

	registerMenu() {
		if (!this.useMenuManager()) return;
		this.menuID = Zotero.MenuManager.registerMenu({
			menuID: 'add-missing-snapshots-item-menu',
			pluginID: this.id,
			target: 'main/library/item',
			menus: [
				{
					menuType: 'menuitem',
					l10nID: this.MENU_L10N_ID,
					onShowing: (_event, context) => {
						context.setEnabled(this.getCandidates(context.items || []).length > 0);
					},
					onCommand: (_event, context) => {
						this.run(context.items || []);
					},
				},
			],
		});
	},

	unregisterMenu() {
		if (this.menuID && this.useMenuManager()) {
			Zotero.MenuManager.unregisterMenu(this.menuID);
		}
		this.menuID = null;
	},

	addToWindow(window) {
		// Make the plugin's Fluent strings available in this window
		window.MozXULElement.insertFTLIfNeeded(this.FTL_FILE);
		if (this.useMenuManager()) return;

		let doc = window.document;
		if (doc.getElementById(this.MENUITEM_ID)) return;
		let menuitem = doc.createXULElement('menuitem');
		menuitem.id = this.MENUITEM_ID;
		menuitem.setAttribute('data-l10n-id', this.MENU_L10N_ID);
		menuitem.addEventListener('command', () => {
			this.run(window.ZoteroPane.getSelectedItems());
		});
		doc.getElementById('zotero-itemmenu').appendChild(menuitem);
	},

	addToAllWindows() {
		for (let win of Zotero.getMainWindows()) {
			if (!win.ZoteroPane) continue;
			this.addToWindow(win);
		}
	},

	removeFromWindow(window) {
		let doc = window.document;
		doc.getElementById(this.MENUITEM_ID)?.remove();
		doc.querySelector(`link[rel="localization"][href="${this.FTL_FILE}"]`)?.remove();
	},

	removeFromAllWindows() {
		for (let win of Zotero.getMainWindows()) {
			if (!win.ZoteroPane) continue;
			this.removeFromWindow(win);
		}
	},

	// Regular items that have a web URL
	getCandidates(items) {
		return items.filter(item => item.isRegularItem()
			&& /^https?:\/\//i.test(item.getField('url') || ''));
	},

	// An imported HTML attachment is what the Connector saves as "Snapshot"
	hasSnapshot(item) {
		return item.getAttachments().some((id) => {
			let attachment = Zotero.Items.get(id);
			return attachment
				&& attachment.attachmentLinkMode == Zotero.Attachments.LINK_MODE_IMPORTED_URL
				&& attachment.attachmentContentType == 'text/html';
		});
	},

	async run(selectedItems) {
		let progress = new Zotero.ProgressWindow();
		progress.changeHeadline('Add Missing Snapshots');
		progress.show();

		if (this.running) {
			progress.addDescription('Snapshots are already being added. Please wait for the current run to finish.');
			progress.startCloseTimer(5000);
			return;
		}

		let items = this.getCandidates(selectedItems)
			.filter(item => item.library.filesEditable && !this.hasSnapshot(item));
		if (!items.length) {
			progress.addDescription('Nothing to add: the selected items already have snapshots or have no web URL.');
			progress.startCloseTimer(5000);
			return;
		}

		this.running = true;
		let added = 0;
		let failed = [];
		try {
			for (let item of items) {
				let line = new progress.ItemProgress('attachmentSnapshot', item.getDisplayTitle());
				line.setProgress(50);
				try {
					// Loads the page in Zotero's hidden browser and saves a
					// SingleFile snapshot, exactly as the Connector does
					await Zotero.Attachments.importFromURL({
						libraryID: item.libraryID,
						url: item.getField('url'),
						parentItemID: item.id,
						title: 'Snapshot',
						contentType: 'text/html',
					});
					line.setProgress(100);
					added++;
				}
				catch (e) {
					this.log(`Could not save a snapshot for "${item.getDisplayTitle()}": ${e}`);
					line.setError();
					failed.push(item.getDisplayTitle());
				}
			}
		}
		finally {
			this.running = false;
		}

		let summary = `Added ${added} snapshot${added == 1 ? '' : 's'}`;
		if (failed.length) {
			summary += `, ${failed.length} failed`;
		}
		progress.changeHeadline(summary);
		progress.startCloseTimer(failed.length ? 15000 : 5000);
	},
};
