# Workspace Manager

**Organize your browser. Focus on what matters.**

[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)
![React](https://img.shields.io/badge/React-19-149ECA?logo=react&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-6-3178C6?logo=typescript&logoColor=white)
![Chrome Extension](https://img.shields.io/badge/Chrome-Extension%20MV3-4285F4?logo=googlechrome&logoColor=white)
![Status](https://img.shields.io/badge/Status-In%20Development-orange)

**Workspace Manager** is an open-source Chrome extension designed to simplify browser tab management, organize workspaces, and help users stay productive.

Instead of manually managing dozens of open tabs, Workspace Manager provides a centralized interface to organize, search, group, save, and restore browsing sessions.

Built with **React, TypeScript, and Chrome Extensions Manifest V3**, the project focuses on productivity, usability, privacy, and extensibility.

---

## Overview

Modern browsing often involves managing multiple projects, research topics, and daily activities simultaneously.

Students, developers, and researchers frequently open numerous tabs for documentation, development tools, articles, and other resources.

As the number of open tabs increases, finding relevant information and switching between tasks becomes increasingly difficult.

Workspace Manager addresses these challenges by providing tools to:

- Organize tabs into meaningful groups.
- Separate browsing resources into dedicated workspaces.
- Save and restore browsing sessions.
- Detect and manage duplicate tabs.
- Navigate between open tabs more efficiently.

The project aims to create a lightweight, privacy-conscious, and community-driven browser productivity tool.

## Features

### 1. Tab Management

Manage open browser tabs directly from the Chrome Side Panel.

- View tabs in the current browser window.
- Search by title, URL, or domain.
- Switch between existing tabs.
- Close individual tabs.
- Automatically refresh the list when tabs change.

### 2. Workspace Management

Organize frequently used websites into dedicated workspaces.

- Create, rename, and delete workspaces.
- Save website links to a workspace.
- Open previously saved pages.
- Organize resources by project or activity.
- Persist workspace data using Chrome Storage.

**Example:** Create separate workspaces for Frontend Development, University Research, and Personal Projects.

### 3. Session Management

Save browsing sessions and return to previous activities.

- Capture currently open tabs.
- Save multiple independent sessions.
- Associate sessions with workspaces.
- Restore sessions in the current or a new browser window.
- Optionally skip duplicate URLs during restoration.
- Review and delete saved sessions.

Session restoration reopens saved URLs. It does not restore unsaved form data or the complete internal state of websites.

### 4. Tab Grouping

Organize browser tabs manually or through domain-based rules.

- Select multiple tabs and group them.
- Assign group names and colors.
- Create, edit, and delete domain rules.
- Preview grouping results before applying changes.
- Reuse matching browser groups where supported.

**Example rules:**

| Domain | Destination Group |
|---|---|
| github.com | Development |
| react.dev | Development |
| chatgpt.com | AI Tools |
| youtube.com | Learning |

Automatic grouping of newly opened tabs is a planned enhancement until validated in the current release.

### 5. Duplicate Tab Detection

Identify and safely manage duplicate browser tabs.

- Detect duplicate HTTP/HTTPS URLs.
- Display duplicate groups and their associated tabs.
- Choose which tab to keep.
- Preview cleanup operations.
- Protect important tabs, including pinned tabs.
- Require confirmation before closing tabs.

Duplicate cleanup is user-controlled and does not automatically remove tabs without confirmation.

---

## Technology Stack

| Technology | Purpose |
|---|---|
| React | User interface development |
| TypeScript | Type-safe application logic |
| Vite | Development and production builds |
| Tailwind CSS | User interface styling |
| Chrome Extensions API | Browser tab and window management |
| Manifest V3 | Chrome extension architecture |
| Chrome Storage API | Local persistence |
| Node.js Test Runner | Automated testing |
| ESLint | Static code analysis |
| Git & GitHub | Version control and collaboration |

## Getting Started

### Prerequisites

Before installing Workspace Manager, ensure you have:

- Google Chrome 116 or later.
- Node.js 24.x recommended for development.
- npm.
- Git.

### 1. Clone the repository

```bash
git clone https://github.com/Cong2005/Workspace_Manager.git
cd Workspace_Manager
```

### 2. Install dependencies

```bash
npm ci
```

This installs dependencies using the existing lockfile.

### 3. Build the extension

```bash
npm run build
```

The production build will be generated in the `dist/` directory.

### 4. Install in Google Chrome

1. Open Google Chrome.
2. Navigate to `chrome://extensions/`.
3. Enable **Developer mode**.
4. Click **Load unpacked**.
5. Select the generated `dist/` directory.
6. Pin Workspace Manager to the browser toolbar.
7. Click the extension icon and open the Side Panel.

Workspace Manager is now ready for local testing.

### 5. Rebuild after changes

After modifying the source code:

```bash
npm run build
```

Return to `chrome://extensions/` and reload the extension to apply the latest changes.

## Development

Available commands:

| Command | Description |
|---|---|
| `npm ci` | Install locked dependencies |
| `npm run dev` | Start the Vite development server |
| `npm run build` | Run TypeScript checks and build |
| `npm run lint` | Run ESLint |
| `npm test` | Run automated tests |

For full extension functionality, use the Chrome extension build rather than relying solely on the Vite development server.

## Architecture

Workspace Manager uses a modular architecture separating user interface components, business logic, browser APIs, and persistent storage.

```text
Workspace_Manager/
├── public/
│   └── manifest.json
├── src/
│   ├── background/
│   ├── popup/
│   ├── sidepanel/
│   │   ├── tabs/
│   │   ├── workspaces/
│   │   ├── sessions/
│   │   ├── grouping/
│   │   └── duplicates/
│   ├── services/
│   └── types/
├── tests/
├── package.json
├── vite.config.ts
└── README.md
```

**Core components**

- **Popup:** Provides an entry point to the extension.
- **Side Panel:** Hosts the main management interface.
- **Background Service Worker:** Handles background events and selected data operations.
- **Services:** Encapsulate browser interactions and business logic.
- **Chrome Storage:** Persists workspaces, sessions, and grouping rules.

## Privacy and Data Storage

Workspace Manager is designed around local browser functionality.

- Workspace and session data are stored using `chrome.storage.local`.
- No account is required for the current implementation.
- No dedicated backend server is required.
- The extension does not intentionally store passwords, cookies, or form contents.
- Browser permissions are used to support the requested tab-management features.

**Privacy notice:** Saved URLs and page titles may contain sensitive information. Users should review the pages they save, especially private links or URLs containing authentication parameters.

## Project Status

Workspace Manager is under active development.

The project includes implementations of tab management, workspaces, sessions, grouping rules, and duplicate detection.

Automated build, lint, and unit testing have been performed during development. Full browser-level integration testing and release validation remain ongoing.

Planned improvements include:

- Automatic grouping of newly opened tabs.
- Tab and workspace statistics.
- Improved user experience and accessibility.
- Additional integration tests.
- Import/export capabilities for saved workspaces.

Features and priorities may evolve based on community feedback.

## Contributing

Contributions, bug reports, suggestions, and improvements are welcome.

To contribute:

1. Fork this repository.
2. Create a feature branch.
3. Implement your changes.
4. Run the available checks:

```bash
npm run build
npm run lint
npm test
```

5. Commit your changes with a descriptive message.
6. Open a Pull Request describing the changes and their purpose.

For bugs or feature requests, please use [GitHub Issues](https://github.com/Cong2005/Workspace_Manager/issues).

Contributors should respect the project's architecture, coding conventions, and open-source license.

## Security

If you discover a potential security issue, please avoid publicly disclosing sensitive exploit details before maintainers have an opportunity to investigate.

Contact the repository maintainers through an appropriate private communication channel when available.

Security-related contributions are particularly welcome, especially those involving browser permissions, URL handling, and local data storage.

## License

Workspace Manager is distributed under the **MIT License**.

See the [LICENSE](LICENSE) file for details.

The MIT License allows use, modification, distribution, and commercial use under its terms, including preservation of the required copyright and permission notice.

## Maintainers and Contributors

Workspace Manager is developed as an educational open-source software project.

**Repository:** [Cong2005/Workspace_Manager](https://github.com/Cong2005/Workspace_Manager)

Contributions from developers, students, and open-source enthusiasts are welcome.

---

**Workspace Manager — Less tab clutter. More productivity.**
