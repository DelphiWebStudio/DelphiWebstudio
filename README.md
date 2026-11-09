# Delphi Web Studio Pro (experimental)

Delphi Web Studio Pro is an offline-first visual website editor for Windows. The desktop application hosts a React and TypeScript editor in an IDE-editable Delphi WebView2 form. It extends [OpenPage](https://github.com/buildingopen/openpage). The original license and attribution remain in the repository.

Project repository: [DelphiWebStudio/DelphiWebstudio](https://github.com/DelphiWebStudio/DelphiWebstudio).

Use the [illustrated editor reference](docs/pdf/Delphi%20Web%20Studio%20Editor%20Reference.pdf) for the current menus, properties windows, Save and Save As, and project media library. The [editable reference](docs/guides/Delphi%20Web%20Studio%20Editor%20Reference.docx) is also available.

## Current status

The editor supports local multi-page projects, reusable sections, independent objects and responsive layout, imported media, and portable JSON or ZIP project files. The Windows host validates project replacements and distinguishes saving a project from exporting a website. For a walkthrough, see [project files](docs/PROJECT_FILES.md), [editor experience](docs/EDITOR_EXPERIENCE.md), and [media library](docs/MEDIA_LIBRARY.md).

The Win32 and Win64 release builds are staged locally under `bin/Win32` and `bin/Win64`. Each executable uses the `editor` folder and matching WebView2 loader beside it. GitHub stores the source and documentation. This is experimental software; test a copy of important projects and review exported pages on your target devices. Local exports do not publish a site.

The [upstream baseline](docs/UPSTREAM_BASELINE.md) and [milestone handoff](docs/WEBSTUDIO_CODEX_HANDOFF.md) record earlier implementation requirements and evidence.

## Development

Baseline verified with Node 24.19.0 and npm 11.6.2:

```sh
npm ci
npm run dev
npm run lint
npm test
npm run build
```

Vite starts at http://localhost:5173; build includes TypeScript checking. Vite alone does not run Vercel API functions. Cloud AI/publishing are optional services; do not enter production credentials or publish sites during ordinary checks.

Native development targets RAD Studio 37.0, Windows x64. WebView2 binding remains to be validated. Node is a development tool, not an end-user requirement.

## Attribution

OpenPage copyright (c) 2026 Federico De Ponte, [MIT](LICENSE). Original history/license are preserved. Original README: [docs/UPSTREAM_README.md](docs/UPSTREAM_README.md). See [third-party inventory and packaging obligations](THIRD_PARTY_NOTICES.md).
