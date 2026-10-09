/* global Zotero */

// Turns a saved page (a Zotero snapshot) into a clean, self-contained reading
// view using Mozilla's Readability, the engine behind Firefox's Reader View.
// Kept free of Zotero APIs so it can be exercised outside Zotero.
ReaderView = {
	// html: the snapshot's HTML; url: the page's original URL; Readability: the
	// Readability constructor; DOMParser: a DOMParser constructor;
	// fallbackTitle: used when the page has no usable title.
	// Returns { title, html } or null when no article body can be found.
	build({ html, url, Readability, DOMParser, fallbackTitle }) {
		let doc = new DOMParser().parseFromString(html, 'text/html');
		if (!doc || !doc.documentElement) return null;

		// Anchor relative links and images to the original page. Snapshots
		// usually have absolute URLs already; this covers the rest.
		if (url && doc.head && !doc.querySelector('base[href]')) {
			let base = doc.createElement('base');
			base.setAttribute('href', url);
			doc.head.insertBefore(base, doc.head.firstChild);
		}

		let article;
		try {
			article = new Readability(doc, { keepClasses: false }).parse();
		}
		catch (e) {
			return null;
		}
		if (!article || !article.content || !article.textContent || article.textContent.trim().length < 200) {
			return null;
		}

		let title = (article.title || fallbackTitle || '').trim();
		// Byline, site, and date; news sites often report the outlet as the
		// author too, so drop repeats
		let meta = [];
		for (let part of [article.byline, article.siteName, this.formatDate(article.publishedTime)]) {
			part = (part || '').trim();
			if (part && !meta.some(seen => seen.toLowerCase() == part.toLowerCase())) meta.push(part);
		}
		let lang = article.lang ? ` lang="${this.escape(article.lang)}"` : '';
		let dir = article.dir ? ` dir="${this.escape(article.dir)}"` : '';

		let out = `<!DOCTYPE html>
<html${lang}${dir}>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${this.escape(title)}</title>
${url ? `<base href="${this.escape(url)}">` : ''}
<style>${this.STYLE}</style>
</head>
<body>
<article class="reader-view">
<header>
<h1>${this.escape(title)}</h1>
${meta.length ? `<p class="reader-meta">${meta.map(s => this.escape(s)).join(' &middot; ')}</p>` : ''}
${url ? `<p class="reader-source">Reader view of <a href="${this.escape(url)}">${this.escape(url)}</a></p>` : ''}
</header>
<div class="reader-content">
${article.content}
</div>
</article>
</body>
</html>
`;
		return { title, html: out };
	},

	formatDate(value) {
		if (!value) return '';
		let d = new Date(value);
		if (isNaN(d.getTime())) return String(value);
		return d.toISOString().slice(0, 10);
	},

	escape(s) {
		return String(s)
			.replace(/&/g, '&amp;')
			.replace(/</g, '&lt;')
			.replace(/>/g, '&gt;')
			.replace(/"/g, '&quot;');
	},

	STYLE: `
:root { color-scheme: light dark; }
body { margin: 0; padding: 2rem 1rem 4rem; background: #fff; color: #1a1a1a;
  font: 1.125rem/1.6 Georgia, "Times New Roman", serif; }
@media (prefers-color-scheme: dark) { body { background: #1c1c1e; color: #e6e6e6; } a { color: #8ab4f8; } }
article.reader-view { max-width: 42rem; margin: 0 auto; }
header h1 { font: 700 2rem/1.2 system-ui, -apple-system, "Segoe UI", sans-serif; margin: 0 0 .75rem; }
.reader-meta, .reader-source { font: .9rem/1.4 system-ui, -apple-system, "Segoe UI", sans-serif; opacity: .75; margin: 0 0 .4rem; }
.reader-source { margin-bottom: 2rem; word-break: break-all; }
.reader-content p { margin: 0 0 1.1em; }
.reader-content h2, .reader-content h3 { font-family: system-ui, -apple-system, "Segoe UI", sans-serif; line-height: 1.25; margin: 1.6em 0 .6em; }
.reader-content img, .reader-content video, .reader-content figure { max-width: 100%; height: auto; }
.reader-content figure { margin: 1.5em 0; }
.reader-content figcaption { font-size: .85rem; opacity: .75; margin-top: .4em; }
.reader-content blockquote { margin: 1.2em 0; padding-left: 1em; border-left: 3px solid #bbb; opacity: .9; }
.reader-content table { border-collapse: collapse; max-width: 100%; font-size: .95rem; }
.reader-content td, .reader-content th { border: 1px solid #ccc; padding: .3em .6em; vertical-align: top; }
.reader-content pre { overflow-x: auto; font-size: .9rem; }
`,
};
