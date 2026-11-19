# Delphi Web Studio Pro release review

## Build 2 review

Reviewed November 19, 2026. Application version **1.0.0 build 2**; Windows file/product version **1.0.0.2**; release tag **v1.0.0.2**.

This update includes automatic visitor translation, permanent local test-folder refresh, expanded Check site and simpler page names/addresses with supported link updates and one-step Undo. Both Windows editions are rebuilt with the same current editor bundle, and the Package Studio Pro authoring projects and installers use the new version. Saved projects, private browser profiles and credentials are excluded from release payloads.

### Code and native workflow validation

- The final full regression suite passed **476 tests**, with **two pre-existing optional integration checks skipped**. TypeScript and full source/API/test lint passed; lint retains one pre-existing non-failing React cleanup warning.
- Both elevated native Release builds passed with Windows file/product version **1.0.0.2**. Existing compiler hints and the earlier optional-local-AI signed/unsigned warning remain unchanged.
- Native local-site suites passed **34 checks per architecture**, including destination guards, pre-refresh ZIP verification, unmanaged-file preservation, managed cleanup, stale-review rejection, failed-write recovery, concurrent-edit preservation, folder-backed HTTP serving and network restrictions.
- Separate native GUI harnesses compiled the production Main form and used staged editor files in isolated profiles. Both passed **31 checks**, including the real folder picker and confirmation, cancellation correlation, reviewed-ZIP download, refresh, persisted folder preference, source-project preservation and the external-link protocol. A 100-file expanded confirmation stayed on screen with its Yes/No controls visible.
- The final three isolated browser workflows passed Page settings, Check site and the local-folder Export UI. Browser tests of native messages use explicit mocks; real native tests establish the corresponding Windows behavior. Native acceptance used test executables sharing production code, not a fresh-Windows VM installation.
- Live native checks classified a successful public HTTPS response, a missing page and an invalid certificate correctly. A current registry advisory query covering all **322 locked package names**, including development versions, returned **zero advisories**. This is not an independent security audit.

### Guides and installer engine

All seven DOCX/PDF pairs were updated and all **165 pages** were visually reviewed. All **172 real linked table-of-contents entries** have right-aligned dot leaders and page numbers matching their companion PDFs. Current screenshots, the build-2 release diagram and the complete **35-language** preset are included. Document text, links, illustrations and metadata were checked for private project information and maintainer contact details.

Package Studio's existing disposable acceptance suite passed custom-folder installation, current-user shortcuts, hash verification, upgrade, failed-upgrade rollback, unsafe-journal rejection, durable registered uninstall, self-cleanup and unrelated-file preservation. The installer engine itself was not modified for this update. Exact new package hashes and payload checks are recorded separately in [release package validation](RELEASE_PACKAGE_VALIDATION.md).

No production website, SFTP destination, DNS setting or live contact form was changed. The editable user projects and existing local website are checked separately against the verified pre-change backup. Previous owner hardware/startup observations below remain historical; they are not fresh-machine measurements of build 2.

## Earlier build 1 review

The following record describes the previous release and retains its original dates and evidence.

Reviewed November 18, 2026. Application version **1.0.0 build 1**; Windows FileVersion and ProductVersion **1.0.0.1**.

### Deliverables and scope

The Win32 and Win64 stages under `bin/Win32` and `bin/Win64` contain the executable, matching Microsoft WebView2 loader and local editor bundle. WebView2 is the browser engine embedded in the Windows editor; the loader connects the application to the installed Runtime. Separate Package Studio Pro installers are assembled under `export/release-1.0.0.1` as `DelphiWebStudioPro-1.0.0.1-Win32-Setup.exe` and `DelphiWebStudioPro-1.0.0.1-Win64-Setup.exe`. The complete `.wiproj` authoring projects retain their matching payloads in Package Studio Pro's MySetups folder.

Setup includes the editor, SFTP workflow, seven illustrated DOCX/PDF guides, privacy/recovery information and applicable license notices. It excludes saved website projects, local profiles, credentials, test fixtures, Node.js, optional AI runtime/model files and the optional serverless API. Package-specific hashes and payload checks are recorded in [release package validation](RELEASE_PACKAGE_VALIDATION.md).

Both editions target Windows 10/11 and require Microsoft Edge WebView2 Runtime. Win64 requires Windows x64; Win32 also runs on x64 Windows. SFTP (SSH File Transfer Protocol) uploads website files over an encrypted connection using Windows OpenSSH Client, an optional Windows component. Its SSH key authenticates the user, while the trusted-hosts file identifies approved servers. Missing OpenSSH does not prevent editing or local export. Setup checks prerequisites and supplies Microsoft's Runtime download address rather than silently adding a dependency.

### Current validation: November 18, 2026

- The full regression run passed **447 tests**, with **two pre-existing optional integration checks skipped** across 35 files (33 passed, two skipped). Full source/API/test ESLint reported zero errors. TypeScript, Vite and both native Release builds passed; executables retain version 1.0.0.1.
- An npm registry bulk advisory request covering all **322 locked package names and their recorded versions**, including development dependencies, returned **zero advisories**. This was a registry advisory check, not a fresh npm CLI audit or an independent penetration test.
- Both actual desktop architectures passed the existing multi-page project review with **zero Check site findings** and **zero Export review findings**. Each generated 109 files including 13 published HTML pages, while unpublished content remained excluded. All original media files used by the export remained byte-identical.
- The generated pages have descriptions and one main H1 heading each; Footer column headings use H2. An Image block Page heading can supply an accessible main heading for title artwork. The footer checker distinguishes contact/address columns from actual navigation labels without removing checks for legacy unlinked navigation.
- Measured desktop geometry retained the same font, color and spacing, with a maximum observed difference of 0.000031 pixels from floating-point measurement. Existing image content was preserved. No visible redesign was introduced by the metadata and semantic corrections.
- All seven manuals were updated against the implementation, refreshed in LibreOffice and rendered. Every page was visually inspected. Their 148 total pages retain the original illustrations, heading structure, tables and external links; all 148 table-of-contents entries have dotted leaders, valid bookmark links and page numbers verified against the PDFs. Companion PDFs match their fresh DOCX renders.

These current checks do not send mail or submit a contact form, make another live Gemini request, publish a website or change a domain. The dummy email destinations remain in place.

### Earlier functional evidence

The earlier release and AI checks remain relevant, with their original dates and scope. Native SFTP loopback checks passed in Win32 and Win64 for connection, inventory, backup, reviewed transfer, host-key rejection, stale/collision rejection and recovery. Win32 resolves the native OpenSSH tools through Sysnative when running on 64-bit Windows. Provider-specific public hosting was not exercised.

Both desktop editions previously passed isolated gallery checks covering old-image normalization, all four addition routes, identical properties, numeric position, duplication, deletion, Undo, reload and Preview. Earlier Gemini checks used the Windows-saved key with synthetic content for selected wording, page/section creation and existing-content follow-ups. The later named-target live checks verified that a hero background request changed the hero and left the lower section unchanged in both editions. Those checks were separately authorized; the November 18 review makes no new Gemini request. See the dated [Gemini records](GEMINI_ASSISTANT.md).

Package Studio lifecycle acceptance previously passed installation, payload hashing, upgrade, failed-upgrade rollback, unsafe journal rejection, durable uninstall, self-cleanup and preservation of user files and unrelated empty folders. Its wizard bundle reader was also exercised with unsigned and synthetic certificate-overlay fixtures. The latter tests file layout handling, not trusted signing. These engine checks are distinct from an interactive upgrade/uninstall of the newly rebuilt final installer on a fresh Windows machine.

### Owner installation observations

The owner reported successful installation and basic editing on an older genuine 32-bit Windows 10 22H2 computer. Its measured startup was approximately 4 minutes 33 seconds; the owner clarified that the system had been shut down and restarted, rather than reinstalled. The same Win32 application started in approximately 14 seconds on a newer Windows 10 x64 machine. The actual Win64 edition on that newer machine started in approximately 6 seconds. Windows 11 startup was approximately 3.7 seconds, with the tested application architecture unspecified.

Those results support testing the matching edition on the intended computer. They do not establish minimum hardware requirements, controlled performance benchmarks, a fresh-Windows VM test or completion of every installed save/reopen/export/upgrade/uninstall path. The Test Guide provides those reproducible acceptance steps.

### Preservation and security boundaries

Before this update, a complete pre-change ZIP was verified, including source, documentation, saved projects and local drafts. The approved metadata and heading corrections preserve page appearance, existing media and dummy email destinations. Setup is separate from the user's website data: it installs per account in architecture-specific folders, and its ownership journal limits uninstall to recorded unchanged files and installer-created empty directories. Saved projects, the separate WebView profile and saved credentials are not removal targets.

The optional online assistant uses Google Gemini. Its API key is a secret credential identifying a Google project; the saved Windows copy is kept in Credential Manager and excluded from portable projects and website exports. Requests authenticate in a header. Free-tier operation requires the owner to keep the Google project on Free tier with billing disabled; the key itself cannot prove that setting. AI proposals are locally validated, reviewed and applied as undoable edits. They cannot publish, upload or send email.

The application and installers are **unsigned**, so Windows may display publisher/reputation warnings. Microsoft signatures on the WebView2 loaders were valid. Original OpenPage MIT attribution and applicable third-party license texts are retained. Legacy serverless API routes are outside the desktop payload and require separate operator authentication, quotas and deployment hardening before public hosting. The recorded checks establish the tested paths and dated known-advisory result; they are not a security certification or a guarantee for every device and provider.
