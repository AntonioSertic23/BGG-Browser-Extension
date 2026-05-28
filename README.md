# BGG Price Paid Total

Browser extension that totals the **Price Paid** values from your [BoardGameGeek](https://boardgamegeek.com) collection and shows payoff statistics based on how often you have played each game.

## What it does

1. Open your BGG collection page while logged in.
2. Click the extension icon.
3. A **detailed report page** opens with every game, thumbnail, price, and payoff status.

When you are on your own collection page, the extension also loads your full owned collection through the BGG API so games on other pages are included.

## Required BGG columns

The extension depends on data from your collection view. Before running it, open the **Columns** menu on your BGG collection page and enable:

| Column | Why it is required |
| --- | --- |
| **Private Info** | Required. This is where BGG stores **Price Paid** for each game. Without this column and without prices entered there, the extension has nothing to sum. |
| **Your Plays** | Required for payoff statistics. The extension uses your logged play count to decide whether a game is paid off and how many more plays are still needed. |

### What to enter in Private Info

For each owned game you want included, add a **Price Paid** value in the **Private Info** column, for example:

- `Price Paid: 45`
- `Price Paid: €45.00`
- `Price Paid: 45 EUR`

Games without a price in Private Info are skipped.

## Install (Chrome / Edge / Brave)

1. Open `chrome://extensions`
2. Enable **Developer mode**
3. Click **Load unpacked**
4. Select this project folder

## Install (Firefox)

1. Open `about:debugging#/runtime/this-firefox`
2. Click **Load Temporary Add-on**
3. Select `manifest.json` from this folder

## Usage

1. Log in to BoardGameGeek.
2. Open your collection, for example:
   `https://boardgamegeek.com/collection/user/YOUR_USERNAME?own=1&subtype=boardgame`
3. In **Columns**, enable **Private Info** and **Your Plays**.
4. Make sure **Price Paid** is filled in under Private Info for the games you want counted.
5. Click the extension icon — the report tab opens automatically.

On the report page you can:

- review every game with its price and thumbnail
- change **Cost per play** to recalculate paid-off / not-paid-off statistics
- filter and sort games

## Payoff statistics

A game is considered **paid off** when:

`Your Plays × cost per play ≥ Price Paid`

Example: a game that cost €10 is paid off after 10 plays if you set the cost per play to €1.

## Expansion plays

On BGG, expansions are often shown **directly below their base game** in the collection list. The extension uses that page order:

- reads rows top to bottom on the collection page
- when a **priced base game** is followed by **unpriced expansions**, their plays are added to the base game's payoff
- unpriced expansions are still listed separately at the bottom of the report

Example: Nemesis cost €200 (base game only), 14 base plays + 5 plays on each of two unpriced expansions listed below it = **24 effective plays**.

If you later add a **Price Paid** to an expansion on BGG, it will be tracked on its own instead of rolling up into the base game.

Expansion rollup uses the **current collection page** layout. Run the extension while Nemesis and its expansions are visible together on the page.

## Notes

- **Private Info** and **Price Paid** are required for price totals.
- **Your Plays** is required for payoff statistics to work correctly.
- If multiple currencies are used, the extension shows one total per currency.
- You must be logged in to your own collection to load private purchase data.
- BGG sometimes needs a few seconds to prepare collection data; the extension retries automatically.

## Files

- `manifest.json` — extension configuration
- `content.js` — runs on BGG collection pages
- `price-parser.js` — parsing and total calculation
- `popup.html` / `popup.js` — quick summary popup
- `report.html` / `report.js` — full game list with images, prices, and payoff stats
