# Refreshing a local website folder

Last changed: November 20, 2026. Version 1.0.0 build 4.

A local test folder contains the visitor-facing website files, including `index.html`, other pages and their assets. It is separate from the saved project ZIP, which contains the editable source. The Windows edition can refresh this folder and serve its contents in your browser without publishing or uploading the website. Python and other development tools are not required.

## Choose and refresh the folder

1. Save your project, open **Export**, and choose **Review files**. This prepares the website from the current pages, settings and media.
2. In **Local test folder**, choose **Choose local test folder** and select a dedicated folder, such as `Website Test`. Each project remembers its own choice on this Windows account.
3. Choose **Refresh local site**. Review the destination and the files that would be replaced or removed. Expand the details when reviewing an older export for the first time.
4. Confirm only when that list is what you intend. Before changing existing affected files, the app creates and verifies a ZIP in a separate folder beside the test folder. Other files are preserved.
5. Choose **Open local site**. The app starts a server on this computer's loopback address and opens the exported Home page in your normal browser. Keep the editor running while testing.

After editing, use **Review files** again and then **Refresh local site**. A review becomes stale when the project changes; the app will not refresh from that stale review. The local test folder is not the editor's live canvas, and saving a project alone does not update it.

## Existing files and recovery

On first use, the confirmation identifies existing filenames that match the reviewed export. Only those explicitly reviewed filenames are adopted. Files not part of that export remain untouched. On later refreshes, a private local manifest identifies the files managed for this project; only managed files that are no longer exported can be removed. A folder registered to another project is rejected.

The pre-refresh ZIP preserves the existing affected files and the prior manifest, when present. If a write fails, the app attempts to restore the previous contents and reports the recovery ZIP. Keep these ZIPs until you have reviewed the refreshed site. They can contain private website material and are not published or automatically deleted. The app does not make a second ZIP after the refresh.

The folder choice is kept in Windows-local preferences, not in the portable project. Moving a project to another computer does not transfer an absolute path from the first machine. The local server serves the recorded website files, not unrelated files or the private management manifest. Closing the editor stops the server; the exported files remain in the chosen folder.

## Translation and other online content

To try TAtlas website translation, enable **Website translation** in **Settings → Project settings** before preparing the export. This uses the same floating GTranslate website widget as the Atlas website. Its selector appears in the browser view, detects the browser language and lets the visitor choose another language. Internet access is required for translation, while the editable English source and editor interface stay unchanged. See [website translation](WEBSITE_TRANSLATION.md) for visitor instructions and service requirements.

External links and remotely hosted content can still use the internet. Local review blocks form submission; do not treat it as an end-to-end test of a live contact service. Check desktop, tablet and phone widths and use [Check site](EDITOR_EXPERIENCE.md) before preparing a public upload. Reviewing and refreshing locally never performs that upload.
