---
source: https://github.com/aautcq/pdfize
fetchedAt: 2026-10-03T16:53:02.000Z
---

# pdfize

A CLI tool to convert HTML files to PDF. It renders the page with headless Chrome via Puppeteer, then shrinks the resulting PDF using Alfred Klomp's `shrinkpdf` script. Supports excluding specific sections from the generated PDF via built-in conventions (`.no-pdf`, `data-pdf-exclude`) or custom CSS selectors.

## Technologies

- Node.js
- TypeScript
- Puppeteer (headless Chrome)
- Cheerio
- Sharp
- Yargs (CLI argument parsing)

Repo: <https://github.com/aautcq/pdfize>
