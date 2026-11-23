# Tropy Analytics

<p align="center">
  <img src="./icon.svg" alt="Tropy Analytics" width="160">
</p>

Charts and connection graphs for your Tropy project. Filter by date, list, tags and metadata. All processing stays on your computer.

## Install

In **Tropy → Preferences → Plugins**, install the release ZIP and enable **Analytics**. Open a project and click the chart icon beside the search field.

## Use

- Use the date range at the top of the left sidebar. Use the right sidebar for field mappings, people fields and chart visibility.
- Collapse filter sections by clicking their headings.
- Collection growth counts matching sources cumulatively by date added or last modified; it does not reconstruct modification history.
- Click a tag to include it, again to exclude it, and once more to clear it.
- Click a person to filter; use mouse back/forward or Alt+Left/Right to navigate.
- Drag graph nodes or use **Untangle graph**. Circle area reflects source count; line thickness reflects shared sources.
- **Open in Tropy** transfers supported filters. Its tooltip identifies limitations.

English, Italian, French and Spanish. Light and dark themes.

## Build

Node.js 18+: `npm ci`, then `npm run build`.

License: AGPL-3.0-or-later. See [LICENSE](LICENSE).
