# Release package validation

## Build 2 on November 19 2026

The current Win32 and Win64 installers contain **Delphi Web Studio Pro 1.0.0 build 2**, Windows file/product version **1.0.0.2**, published under **v1.0.0.2**. Earlier tags and packages remain historical releases.

| Edition | Installer | Bytes | SHA-256 |
| --- | --- | ---: | --- |
| Win32 | DelphiWebStudioPro-1.0.0.2-Win32-Setup.exe | 24,803,963 | 5acfbb4777ce7425ce4bfe6778f33e554f903258b1d77da461ad76122b021bf4 |
| Win64 | DelphiWebStudioPro-1.0.0.2-Win64-Setup.exe | 25,303,811 | 2ea15ab2667be7ec4390841dd806b6583cec5098ee6b28b74d2ade823dbeb169 |

Each installer has a matching SHA-256 sidecar under export/release-1.0.0.2. Its embedded ZIP passed the corruption check. All **43 payload files per edition** matched the final source/build files and the retained Package Studio Pro payload, including all **14 reviewed guide files**. Those guides contain **164 visually reviewed pages** and **172 real linked dotted-leader TOC entries**.

These packages refresh the translation wording in the included guides and notices. TAtlas website translation uses the Atlas site's floating GTranslate widget for website visitors; it does not translate the editor interface or provide application language packs. Both application executables, the editor bundle and the working website translation configuration remain byte-identical to the original build-2 release. Package fingerprints change because the documentation changed. The original release tag remains a historical source snapshot; current default-branch documentation and release descriptions contain the correction.

The executable, editor bundle and Microsoft WebView2 loader match the intended architecture. Both executables retain the seven icon sizes (16, 24, 32, 48, 64, 128 and 256 pixels), and both Microsoft loaders have valid signatures. The final frontend bundle is index-DghZumQS.js, SHA-256 1040da5f5a636b43d6de4fbb3ced7fa6af7bb3f6f9b5a5f4e88f643c19e9e856; it is byte-identical to the bundle exercised by the native GUI tests.

The console installer runtime's non-resource PE sections match the repaired Package Studio Pro runtime. Its intentionally updated process manifest requests asInvoker; this resource update is why the whole runtime hash differs from the builder's source binary. Installer manifests use neutral publisher information and relative payload paths, with no signing-tool or certificate path.

The complete authoring projects and current payloads are retained locally under Package Studio Pro's MySetups/DelphiWebStudioPro-1.0.0.2. Open the Win32 or Win64 .wiproj to build that edition. These machine-specific authoring files remain outside public source control; the reproducible packaging script is tools/package-release.ps1.

### Validation and preservation

The full regression suite passed **476 tests**, with two pre-existing optional checks skipped. Full lint and TypeScript passed; one earlier non-failing React cleanup warning remains. Elevated Release builds, three isolated browser workflows, **34 native unit checks per architecture** and **31 production-Main-form GUI checks per architecture** passed. The native tests used isolated synthetic profiles and test executables sharing production code; they are not a fresh-Windows VM installation claim.

Package Studio's disposable lifecycle suite passed custom-folder install, current-user shortcuts, hash verification, upgrade, failed-upgrade rollback, unsafe-journal rejection, durable registered uninstall and unrelated-file preservation. The engine was not modified. A current registry advisory query covering all 322 locked package names and recorded versions, including development dependencies, returned zero advisories.

Payload text and guide XML, links and metadata were checked for private identifiers. **115 protected files**, comprising the saved projects, existing local website and pre-existing local README edit, remained byte-identical to the pre-change ZIP. No user project, browser profile, credential or local website export was included in the packages. The exact local verification record is export/release-1.0.0.2/package-verification.json.

No website was published, form submitted, production SFTP server contacted or DNS setting changed. A successful link response is not a security or accessibility certification. Earlier owner startup observations and current test limits are recorded in the [release review](RELEASE_1_0_REVIEW.md).

## Earlier build 1 package record

The following material is a dated historical record. Its hashes, counts and versions describe the earlier packages.

The Win32 and Win64 installers contain Delphi Web Studio Pro **1.0.0 build 1**, with Windows file/product version **1.0.0.1**. The release tag is **v1.0.0.1**; the older v1.0.0 tag is preserved. Both applications were rebuilt after the page-heading and footer-checker corrections. All seven illustrated manuals and their companion PDFs are included.

## Installer and authoring files

The installers are in `export/release-1.0.0.1`:

| Edition | Installer | Bytes | SHA-256 |
| --- | --- | ---: | --- |
| 32-bit | `DelphiWebStudioPro-1.0.0.1-Win32-Setup.exe` | 24,360,895 | `8a1b6d915edf35a4b3222dbe86bfafd5b0310bed13c28d56b8ce0bf9c2069596` |
| 64-bit | `DelphiWebStudioPro-1.0.0.1-Win64-Setup.exe` | 24,852,195 | `f3b90ed680dab313c50f11adcda093d319c608b59446977e73b5ce6ad7b518d0` |

SHA-256 is a file fingerprint that identifies the exact tested package. Each installer has a matching `.sha256` file. The detailed local record is `export/release-1.0.0.1/package-verification.json`.

The complete Package Studio Pro authoring projects and matching payloads are saved under `MySetups\DelphiWebStudioPro-1.0.0.1` in the selected Package Studio Pro folder. Open the `.wiproj` ending in `Win32` or `Win64` to build that edition. Previously generated historical export copies are not the current deliverables.

## Application and documentation checks

The complete regression run passed **447 tests**, with **two pre-existing optional integration checks skipped**. ESLint found no errors in the source, API and tests. TypeScript, Vite and both elevated native Release builds passed. An npm registry bulk advisory check covering all 322 locked package names and their recorded versions, including development dependencies, returned zero advisories. This was a dated registry check, not an independent security audit.

The actual Win32 and Win64 executables were tested with the existing multi-page project in isolated local profiles. Each reported **zero Check site findings and zero Export review findings**, then generated a valid 109-file website ZIP containing 13 published pages. Each published page has its description and one main H1 heading; footer column titles use H2. Unpublished content remained excluded from the export. All exported original media bytes were preserved, and measured image/footer styles and layout remained unchanged within floating-point precision. No JavaScript page errors occurred. Initial local asset lookups during asynchronous import were distinguished from the final rendered and exported results.

All seven manuals were refreshed in LibreOffice and rendered. Every one of their **148 pages** was visually reviewed. All **148 table-of-contents entries** have dotted leaders, working bookmark destinations and page numbers matching their companion PDFs. Original illustrations, tables, heading order and external links were preserved. The manuals explain descriptions, semantic headings, image title artwork, footer checks, local export and the tested release scope.

The earlier authorized live Gemini tests on both architectures verified that a named hero color change affected the hero and left the lower section unchanged, with Preview, Apply and Undo. This refresh made no additional Gemini request. The broader dated functional evidence and owner installation observations are in the [release review](RELEASE_1_0_REVIEW.md).

## Package checks

Each embedded ZIP passed its corruption check. All **40 payload files per edition** matched the current originals and saved authoring payload byte for byte, including the architecture-matched executable and Microsoft WebView2 loader, `index-Cg7QEAXm.js` editor bundle, all **14 guide files**, final README, licensing/privacy notices and SFTP instructions. No stale editor assets or unexpected payload files were present. Both loaders had valid Microsoft signatures.

Both packages have the correct per-user installation folder, platform prerequisites and three shortcuts. Their embedded console installer runtimes passed dry-runs with **40 planned file copies and three shortcuts**. The builder changes the Windows privilege manifest for per-user installation; executable sections outside the resource section still match the original runtime. Both graphical and console installer manifests specify `asInvoker`.

The November 19 refresh also corrected a reproduced custom-folder failure. The previous engine selected all-users shortcut folders when the destination was outside the user profile, despite the package running without elevation. It now uses current-user shortcuts consistently with its existing HKCU uninstall registration, and logs the original exception before rollback.

The rebuilt packages passed four isolated lifecycle cases: Win32 and Win64, each in a default-type per-user folder and a writable custom folder outside the profile. Every case verified all 40 payload files and all three current-user shortcuts, upgraded the existing test installation, ran Verify and invoked the registered installed uninstaller with self-cleanup. Unrelated synthetic project files, empty folders and sibling files were preserved; no all-users shortcuts were created. Only the fixture product/shortcut identity and destination were changed. This exercises the actual packaged engine and complete payload, not an untouched graphical wizard or fresh-Windows installation.

A separate deep-path reinstall case produced a 263-character backup filename and failed at the legacy Windows path limit. Rollback preserved all 40 previously installed files; Verify and registered uninstall subsequently passed. This case is recorded as a limitation, not a passing long-path test. Use a short installation folder. Legacy installations that created all-users shortcuts require their original uninstaller and permissions before reinstalling; the path safeguards were not widened to migrate those journals.

## Preservation and cleanup

Before changes, the complete pre-change backup ZIP was checked successfully. It contains 2,888 entries and passed ZIP CRC verification; its private location and fingerprint are omitted from this public record.

The existing multi-page project received descriptions and an accessible main heading for title artwork. Its media, page paths and visibility, appearance and dummy email destinations were preserved. Its matching local draft was updated with exact-before-value checks and verified after a normal restart; unrelated drafts remained unchanged. Existing local website exports and other saved projects were preserved. On another computer, open the corrected project ZIP to obtain its metadata changes; installing the new editor alone does not rewrite an older project copy.

Temporary browser profiles, extracted installer payloads and builder output were removed after their checks. Private website projects, drafts and credentials are excluded from the installers and GitHub release assets. No website was published, no domain was changed and no email was sent.

## Requirements and practical limits

Both editions require Windows 10 or 11 and Microsoft Edge WebView2 Runtime; Win64 requires 64-bit Windows. SFTP uses the optional Windows OpenSSH Client and the user's own server credentials. Gemini requires internet access and the user's own saved Google key. Free-tier operation requires the Google project to remain on Free tier with billing disabled; Google controls quotas and availability. Ordinary local editing and export need neither service.

The application and installers are unsigned, so Windows may display publisher or reputation warnings. Very old computers can have substantially longer startup times. See [compatibility](COMPATIBILITY.md), [known limitations](KNOWN_LIMITATIONS.md) and the [release review](RELEASE_1_0_REVIEW.md) for details. Validation supports the documented paths rather than guaranteeing every device or hosting provider.

## Privacy publishing scope

Current source records use neutral maintainer identities and generic machine/project examples. Private website projects and local installer authoring inputs remain outside published source. The seven application guide pairs were checked without changing their verified layout; Package Studio illustrations containing identifying fields were replaced with neutral real-form examples. Required upstream attribution and third-party license notices are preserved.

Published branch and tag history is being replaced with the reviewed sanitized history. Independent forks, previously downloaded copies and GitHub-held historical references are outside this operation's direct control; this record does not claim their erasure.
