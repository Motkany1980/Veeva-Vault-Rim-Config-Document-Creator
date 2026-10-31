# Veeva Vault RIM Config Documenter

Chrome and Microsoft Edge browser extension (Manifest V3) for Veeva Vault Administrators and Configuration Engineers. It records configuration steps, UI navigation paths, screenshots, and modified components (`vault_component__v`) while you work in Vault, and exports everything into a formatted Microsoft Word (`.docx`) document.

> **Read-Only Guarantee:** All communication with Veeva Vault REST APIs is strictly **read-only** (`GET` and `VQL SELECT` queries only). The extension never creates, updates, or deletes data in Vault.

![Veeva Vault RIM Config Document Creator](Images/Veeva%20Documentator%201.png)
---

## Features

- **Click-to-Document Navigation Paths:** Hold number keys (`0`–`4`) while clicking elements in Veeva Vault to chain steps (`Go to Admin > Configuration > Document Types`), start new lines, add indented sub-items, take screenshots, or log components.
- **Automatic API Name Extraction:** Detects technical API names (`__c`, `__v`, `__sys`, `__rim`) displayed next to labels and appends them automatically (e.g., `Comparison Table (comparison_table__c)`).
- **In-Browser Screenshot Capture & Annotation:** Captures the active Vault tab on `2 + Left Click` and includes a built-in editor to draw red highlight boxes, arrows, numbered badges, or redact sensitive text.
- **Read-Only SSID Session & Component Tracking:** Auto-detects the active Vault session (`SSID`) from browser cookies (or connects via manual SSID / credentials) to query `vault_component__v` or scan Admin tables on screen.
- **Release & Change Header:** Captures `Cycle / Release Name`, `Requester Name`, `Developer Name`, `Ticket ID`, and `Original Request Description`, placing them in a structured table at the top of the exported Word document.
- **Compact Sunrise UI Workspace:** Matches the Veeva Vault Admin look and feel, supports opening in a standalone **Pop-out Window**, adjustable font scaling (`A-` / `A+`), collapsible sections/cards, and a single-click **Reset All** button.
- **Multiple Export Formats:**
  - Microsoft Word (`.docx`) with embedded PNG screenshots and component blocks
  - Formatted plain text (Clipboard)
  - Confluence / Jira Markdown tables
  - `vault_component__v` VQL query for [Veeva Vault Toolbox](https://github.com/veeva/Vault-Toolbox)
  - `.json` session backup (Export / Import)

---

## Installation

1. Clone or download this repository to a permanent folder on your computer:
   ```bash
   git clone https://github.com/<your-org>/veeva-vault-rim-config-documenter.git
   ```
2. Open your browser and navigate to the Extensions management page:
   - **Google Chrome:** `chrome://extensions`
   - **Microsoft Edge:** `edge://extensions`
3. Enable **Developer mode** (toggle switch in the top-right corner in Chrome, or left sidebar in Edge).
4. Click **Load unpacked**.
5. Select the project folder containing `manifest.json`.
6. Click the **Extensions** (puzzle piece) icon on the browser toolbar and **Pin** `Veeva Vault RIM Config Documenter`.

> **Note:** If you already had a Veeva Vault tab open before loading the extension, press `F5` once on that tab so the content script attaches to the page.

---

## Usage Guide

### 1. Opening the Workspace
- **Side Panel:** Click the orange/slate **V** icon on your browser toolbar to open the extension in the side panel.
- **Pop-out Window:** Click **Pop-out Window** in the top header bar to open the tool in a separate, resizable floating window (useful on a dual-monitor setup).
- **UI Density & Collapsible Sections:** Use **A-** and **A+** in the header to change the font size. Click any section bar (`SSID CONNECTION`, `CONTROLS & SETTINGS`, `CYCLE, REQUESTER, DEVELOPER & ORIGINAL REQUEST`) or individual step card header (`▾` / `▸`) to collapse or expand it.

### 2. Recording Steps with Keyboard + Mouse Shortcuts
Make sure the recording toggle in the top-right corner is set to **Active**. Hold down a key (`0`–`4`) on your keyboard and **Left-Click** any element in Veeva Vault.

*(Tip: You can also click the `0+Click` … `4+Click` badges in the panel or on the floating bottom-right HUD bar to lock a mode without holding down the key. Press `Esc` to unlock.)*

| Shortcut | Action | Description & Example Output |
| :--- | :--- | :--- |
| **`0` + Left Click** | **Chain Step (` > `)** | Captures the clicked label (and API name if present) and appends it to the active step separated by ` > `. Automatically prefixes `"Go to "` to the first navigation item of a line.<br>`Go to Admin > Configuration > Document Types > Regulatory` |
| **`1` + Left Click** | **New Line** | Inserts an empty line (`\n\n`) and starts a new configuration line with the clicked item.<br>`Go to Admin > Configuration > Document Fields` |
| **`2` + Left Click** | **Capture Screenshot** | Captures a full-resolution screenshot of the active Vault tab and inserts it right below the current step. Click **Annotate** on the image card to add red boxes, arrows, badges, or redactions. |
| **`3` + Left Click** | **Indented Sub-item** | Appends the clicked label on a new indented line (`   > Item`). Ideal when adding multiple Document Types, fields, or picklist values:<br>`   > Drug Substance Specification Comparison`<br>`   > Drug Product Specification Comparison` |
| **`4` + Left Click** | **Record Component** | Extracts `Name`, `Component Name`, `Component Type`, and `Modified Date` from the clicked Admin table row or detail page and adds it to the **Components** list. |

### 3. Document Header (Cycle, Requester, Developer & Original Request)
Expand **CYCLE, REQUESTER, DEVELOPER & ORIGINAL REQUEST** to fill in:
- **Cycle / Release Name** (e.g., `2026 R2 - Cycle 3`)
- **Requester Name**
- **Developer Name**
- **Original Request Description**

These values are rendered in a formatted summary table and request box at the very beginning of the exported Word (`.docx`) document.

### 4. Connecting to Veeva Vault (SSID) & Querying Components
1. Open an active Veeva Vault tab (`*.veevavault.com`) and click **Auto-SSID** in the **SSID CONNECTION** bar.
   - To connect manually, expand **SSID CONNECTION**, enter the **Vault DNS** (e.g., `company-rim.veevavault.com`), and paste your **Session ID (SSID)** or sign in with your Vault credentials.
2. Go to the **Components** tab, choose a query mode, and click **Query**:
   - *Components referenced in recorded steps* (queries `vault_component__v` for API names captured in your steps)
   - *Components modified today (Modified Today)*
   - *Components modified in the last 1 hour*
   - *Scan component table on active Veeva page* (reads the HTML table currently visible on screen without an API call)

### 5. Exporting & Resetting
- **Download Word (.docx):** Exports the complete specification as a Microsoft Word document.
- **Copy Text:** Copies the plain-text steps and component block to the clipboard.
- **Reset All:** Available in both the top header and bottom footer bar; clears all recorded steps, screenshots, components, and entered header fields at once.

---

## Sample Output Format

```text
Cycle / Release: 2026 R2 - Cycle 3
Requester: Jane Doe
Developer: John Smith

Original Request:
Add the new Comparison Document Types, assign the Additional Information shared field, and update the Commitment Detail Page Layout.
------------------------------------------------------------

Go to Admin > Configuration > Document Types > Regulatory > Administrative Information > Click the action menu next to Comparison Table (comparison_table__c) > Add Sibling > Add the following Document Types:
   > Drug Substance Specification Comparison
   > Drug Substance Batch Analysis Comparison
   > Drug Product Specification Comparison
   > Drug Product Batch Analysis Comparison

[+ Embedded Screenshot]

Go to Admin > Configuration > Document Fields > Regulatory > Administrative Information > On all four Document Types created in the previous step > Add > Existing Shared Field > Additional Information (additional_information__c)

[+ Embedded Screenshot]

Go to Admin > Configuration > Objects > Commitment > Layouts > Commitment Detail Page Layout > Details section > Remove “Commitment Status” > Save

[+ Embedded Screenshot]

Components  :
Name: (Inactive) Dienog tb 2 mg MRP KZ-EAEU KZ -
Component Name: inactive_dienog_tb_2_mg_mrp_kzeaeu_kz__c
Component Type : Report
 Modified Date : 2026-08-08 3:07 AM - 2026-01-20 3:08 PM

Name: (Inactive) Dienog tb 2 mg MRP KZ-EAEU KZ -
Component Name: inactive_dienog_tb_2_mg_mrp_kzeaeu_k1__c
Component Type : Report
 Modified Date : 2026-08-08 3:21 AM - 2026-01-20 3:08 PM
```

---

## Project Structure

```text
├── manifest.json          # Chrome / Edge Manifest V3 configuration
├── background.js          # Service worker (SSID auth, read-only VQL queries, screenshot capture)
├── content.js             # In-page DOM inspector, API name extractor, 0-4+Click handler & HUD
├── content.css            # Styling for element hover highlights and in-page HUD
├── sidepanel.html         # Extension side panel & pop-out window markup
├── sidepanel.css          # Veeva Vault Sunrise UI compact & collapsible styling
├── sidepanel.js           # UI controller, state persistence, annotator, and VQL generator
├── docx-generator.js      # Standalone OOXML (.docx) generator with PNG embedding (zero dependencies)
├── test-veeva-mock.html   # Local Veeva Vault Admin sandbox page for offline testing
└── icons/
    └── icon.svg           # Vector application icon
```
