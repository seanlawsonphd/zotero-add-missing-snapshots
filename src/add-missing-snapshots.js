/* global Zotero, Services, DOMParser, ReaderView */

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
	READER_MENUITEM_ID: 'add-missing-snapshots-reader-view',
	READER_MENU_L10N_ID: 'add-missing-snapshots-reader-view',
	READER_VIEW_TITLE: 'Reader view',
	Readability: null,

	init({ id, version, rootURI }) {
		if (this.initialized) return;
		this.id = id;
		this.version = version;
		this.rootURI = rootURI;
		this.initialized = true;
		this.loadReadability();
		this.registerMenu();
	},

	// Mozilla's Readability (src/lib/Readability.js) is loaded into its own
	// scope so it adds nothing to the plugin's globals
	loadReadability() {
		let scope = {};
		Services.scriptloader.loadSubScript(this.rootURI + 'lib/Readability.js', scope);
		this.Readability = scope.Readability;
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
				{
					menuType: 'menuitem',
					l10nID: this.READER_MENU_L10N_ID,
					onShowing: (_event, context) => {
						context.setEnabled((context.items || []).some(item => item.isRegularItem()));
					},
					onCommand: (_event, context) => {
						this.createReaderViews(context.items || []);
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
		let readerItem = doc.createXULElement('menuitem');
		readerItem.id = this.READER_MENUITEM_ID;
		readerItem.setAttribute('data-l10n-id', this.READER_MENU_L10N_ID);
		readerItem.addEventListener('command', () => {
			this.createReaderViews(window.ZoteroPane.getSelectedItems());
		});
		doc.getElementById('zotero-itemmenu').appendChild(readerItem);
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
		doc.getElementById(this.READER_MENUITEM_ID)?.remove();
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

	// An imported HTML attachment is what the Connector saves as "Snapshot";
	// reader views made by this plugin are imported HTML too, so exclude them
	isSnapshot(attachment) {
		return attachment
			&& attachment.isAttachment()
			&& attachment.attachmentLinkMode == Zotero.Attachments.LINK_MODE_IMPORTED_URL
			&& attachment.attachmentContentType == 'text/html'
			&& !this.isReaderView(attachment);
	},

	isReaderView(attachment) {
		return attachment
			&& attachment.isAttachment()
			&& attachment.getField('title') == this.READER_VIEW_TITLE;
	},

	getAttachments(item) {
		return item.getAttachments().map(id => Zotero.Items.get(id)).filter(Boolean);
	},

	hasSnapshot(item) {
		return this.getAttachments(item).some(attachment => this.isSnapshot(attachment));
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

	async createReaderViews(selectedItems) {
		let progress = new Zotero.ProgressWindow();
		progress.changeHeadline('Create Reader View');
		progress.show();

		if (this.running) {
			progress.addDescription('Another run is in progress. Please wait for it to finish.');
			progress.startCloseTimer(5000);
			return;
		}

		let items = selectedItems.filter(item => item.isRegularItem() && item.library.filesEditable);
		if (!items.length) {
			progress.addDescription('Select one or more regular items that have a snapshot.');
			progress.startCloseTimer(5000);
			return;
		}

		this.running = true;
		let added = 0;
		let skipped = { exists: 0, noSnapshot: 0, unreadable: 0 };
		let failed = [];
		try {
			for (let item of items) {
				let line = new progress.ItemProgress('attachmentSnapshot', item.getDisplayTitle());
				line.setProgress(50);
				try {
					let result = await this.createReaderView(item);
					if (result == 'added') {
						added++;
					}
					else {
						skipped[result] = (skipped[result] || 0) + 1;
						line.setText(`${item.getDisplayTitle()} (${this.describeSkip(result)})`);
					}
					line.setProgress(100);
				}
				catch (e) {
					this.log(`Could not create a reader view for "${item.getDisplayTitle()}": ${e}`);
					line.setError();
					failed.push(item.getDisplayTitle());
				}
			}
		}
		finally {
			this.running = false;
		}

		let summary = `Added ${added} reader view${added == 1 ? '' : 's'}`;
		let skippedTotal = Object.values(skipped).reduce((a, b) => a + b, 0);
		if (skippedTotal) summary += `, ${skippedTotal} skipped`;
		if (failed.length) summary += `, ${failed.length} failed`;
		progress.changeHeadline(summary);
		if (skipped.noSnapshot) {
			progress.addDescription('Items without a snapshot were skipped. Run "Add Missing Snapshots" first.');
		}
		progress.startCloseTimer(failed.length || skippedTotal ? 15000 : 5000);
	},

	describeSkip(reason) {
		switch (reason) {
			case 'exists': return 'already has a reader view';
			case 'noSnapshot': return 'no snapshot';
			case 'noFile': return 'snapshot file not available';
			case 'noURL': return 'no URL';
			case 'unreadable': return 'no article text found';
			default: return reason;
		}
	},

	// Builds a reader view from the item's oldest snapshot and saves it as a
	// second attachment; the original snapshot is left untouched
	async createReaderView(item) {
		let attachments = this.getAttachments(item);
		if (attachments.some(attachment => this.isReaderView(attachment))) return 'exists';
		let snapshot = attachments
			.filter(attachment => this.isSnapshot(attachment))
			.sort((a, b) => (a.dateAdded < b.dateAdded ? -1 : 1))[0];
		if (!snapshot) return 'noSnapshot';

		let path = await snapshot.getFilePathAsync();
		if (!path) return 'noFile';
		let url = snapshot.getField('url') || item.getField('url');
		if (!/^https?:\/\//.test(url)) return 'noURL';

		let html = await Zotero.File.getContentsAsync(path);
		let built = ReaderView.build({
			html,
			url,
			Readability: this.Readability,
			DOMParser,
			fallbackTitle: item.getDisplayTitle(),
		});
		if (!built) return 'unreadable';

		await Zotero.Attachments.importFromSnapshotContent({
			url,
			snapshotContent: built.html,
			title: this.READER_VIEW_TITLE,
			parentItemID: item.id,
		});
		return 'added';
	},
};
