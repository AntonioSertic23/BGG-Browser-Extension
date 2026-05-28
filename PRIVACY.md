# Privacy Policy — BGG Price Paid Total

**Last updated:** May 28, 2026

This extension helps you total **Price Paid** values and payoff statistics from your own [BoardGameGeek](https://boardgamegeek.com) collection.

## Summary

- Your data stays on your device.
- The extension does **not** send your collection data to the developer or to any third-party server operated by this project.
- No analytics, tracking, or advertising are built into the extension.

## What data the extension accesses

When you run the extension on a BoardGameGeek collection page, it may read:

- Collection information visible on the page (including **Private Info** and **Your Plays** when those columns are enabled)
- Your BGG username from the page or session, to verify you are viewing your own collection
- Purchase prices and play counts needed to calculate totals and payoff statistics

If you are logged in to BoardGameGeek, the extension may also request your collection from the official BGG API using your existing browser session cookies. This is the same type of request the BGG website makes when you view your collection.

## What data is stored locally

The extension stores a small amount of data in your browser using Chrome’s local storage:

- The most recent report results (game names, prices, play counts, thumbnails)
- Your **Cost per play** setting and preferred currency

This data is used only to display the report page and remember your preferences. It is not uploaded anywhere by the extension.

## What the extension does not do

- It does not collect passwords or payment card details.
- It does not sell or share your data.
- It does not run on websites other than `boardgamegeek.com` (as configured in the extension manifest).

## Third-party services

BoardGameGeek is a third-party website. When the extension reads data from BGG or calls the BGG API, that communication is subject to [BoardGameGeek’s own policies](https://boardgamegeek.com).

Thumbnails and other images may be loaded directly from BoardGameGeek’s servers when shown in the report.

## Permissions

| Permission | Why it is used |
| --- | --- |
| `activeTab` | Run only when you click the extension on the current BGG tab |
| `scripting` | Inject the content script if the page was opened before the extension was installed |
| `storage` | Save report data and your cost-per-play settings locally |
| `host_permissions` for `boardgamegeek.com` | Read your collection page and call the BGG API with your logged-in session |

## Data retention and deletion

- Uninstalling the extension removes its locally stored data from your browser.
- You can also clear extension data from your browser’s extension/site settings.

## Children

This extension is not directed at children under 13.

## Changes

This policy may be updated if the extension’s behavior changes. The latest version will be kept in this repository.

## Contact

For privacy questions about this extension, open an issue on the project’s GitHub repository.
