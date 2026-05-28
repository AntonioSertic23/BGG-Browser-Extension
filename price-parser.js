const CURRENCY_SYMBOLS = {
  $: "USD",
  "€": "EUR",
  "£": "GBP",
  "¥": "JPY",
  "₹": "INR",
  "₩": "KRW",
  "₪": "ILS",
  "₺": "TRY",
  "₱": "PHP",
  "₫": "VND",
  "₴": "UAH",
  "₦": "NGN",
  "₡": "CRC",
  "₲": "PYG",
  "₵": "GHS",
  "₸": "KZT",
  "₼": "AZN",
  "₽": "RUB",
  "₾": "GEL",
  "₿": "BTC",
  "zł": "PLN",
  "kr": "SEK",
  Kč: "CZK",
  "R$": "BRL",
  "CHF": "CHF",
  "CAD": "CAD",
  "AUD": "AUD",
  "NZD": "NZD",
  "HKD": "HKD",
  "SGD": "SGD",
  "MXN": "MXN",
  "NOK": "NOK",
  "DKK": "DKK",
  "HUF": "HUF",
  "RON": "RON",
  "BGN": "BGN",
  "HRK": "HRK",
  "ISK": "ISK",
  "THB": "THB",
  "MYR": "MYR",
  "IDR": "IDR",
  "VND": "VND",
  "TWD": "TWD",
  "CNY": "CNY",
  "KRW": "KRW",
  "INR": "INR",
  "JPY": "JPY",
  "GBP": "GBP",
  "EUR": "EUR",
  "USD": "USD",
  "SEK": "SEK",
  "PLN": "PLN",
  "CZK": "CZK",
  "BRL": "BRL",
};

const PRICE_PAID_PATTERN = /Price\s+Paid\s*:?\s*([^\n\r]+)/i;
const PLAYS_PATTERN = /(?:User\s+)?Plays\s*:?\s*(\d+)/i;
const DEFAULT_COST_PER_PLAY = 1;
const DEFAULT_COST_PER_PLAY_CURRENCY = "EUR";
const SETTINGS_KEY = "bggPayoffSettings";

function normalizeCurrencyCode(value) {
  if (!value) {
    return null;
  }

  const trimmed = value.trim().toUpperCase();
  return CURRENCY_SYMBOLS[trimmed] || CURRENCY_SYMBOLS[value.trim()] || trimmed;
}

function parseAmount(rawAmount) {
  if (!rawAmount) {
    return null;
  }

  let amountText = rawAmount.trim();
  amountText = amountText.replace(/\s+/g, "");

  const commaDecimal = /,\d{1,2}$/.test(amountText) && amountText.includes(".");
  if (commaDecimal) {
    amountText = amountText.replace(/\./g, "").replace(",", ".");
  } else if (amountText.includes(",") && !amountText.includes(".")) {
    amountText = amountText.replace(",", ".");
  } else {
    amountText = amountText.replace(/,/g, "");
  }

  amountText = amountText.replace(/[^\d.-]/g, "");
  const amount = Number.parseFloat(amountText);
  return Number.isFinite(amount) ? amount : null;
}

function parseMoneyValue(rawValue) {
  if (!rawValue) {
    return null;
  }

  const cleaned = rawValue.replace(/\u00a0/g, " ").trim();
  if (!cleaned || /^n\/a$/i.test(cleaned) || /^-+$/i.test(cleaned)) {
    return null;
  }

  let currency = null;
  for (const [symbol, code] of Object.entries(CURRENCY_SYMBOLS)) {
    if (cleaned.includes(symbol)) {
      currency = code;
      break;
    }
  }

  const codeMatch = cleaned.match(/\b([A-Z]{3})\b/);
  if (codeMatch) {
    currency = normalizeCurrencyCode(codeMatch[1]);
  }

  const amount = parseAmount(cleaned);
  if (amount === null) {
    return null;
  }

  return {
    amount,
    currency: currency || "UNKNOWN",
  };
}

function parsePricePaidFromText(text) {
  const match = text.match(PRICE_PAID_PATTERN);
  if (!match) {
    return null;
  }

  return parseMoneyValue(match[1]);
}

function addToTotals(totals, entry) {
  if (!entry || entry.amount === null) {
    return;
  }

  const key = entry.currency || "UNKNOWN";
  if (!totals[key]) {
    totals[key] = 0;
  }
  totals[key] += entry.amount;
}

function totalsFromGames(games) {
  const totals = {};
  for (const game of games) {
    addToTotals(totals, game);
  }
  return totals;
}

function gameDedupeKey(game) {
  if (game.objectId) {
    return `id:${game.objectId}`;
  }
  return `name:${game.name.toLowerCase()}|${game.amount}|${game.currency}`;
}

function dedupeGames(games) {
  const seen = new Set();
  const unique = [];
  let duplicatesRemoved = 0;

  for (const game of games) {
    const key = gameDedupeKey(game);
    if (seen.has(key)) {
      duplicatesRemoved += 1;
      continue;
    }
    seen.add(key);
    unique.push(game);
  }

  return { games: unique, duplicatesRemoved };
}

function finalizeGameList(games, withoutPrice = 0) {
  const { games: uniqueGames, duplicatesRemoved } = dedupeGames(games);
  uniqueGames.sort((left, right) => left.name.localeCompare(right.name));

  return {
    games: uniqueGames,
    totals: totalsFromGames(uniqueGames),
    withPrice: uniqueGames.length,
    withoutPrice,
    totalItems: uniqueGames.length + withoutPrice,
    duplicatesRemoved,
  };
}

function extractPlaysFromRow(row) {
  const playsCell = row.querySelector("[class*='plays'], [data-column='plays'], td.plays");
  const cellText = playsCell?.textContent || "";
  const cellMatch = cellText.match(/(\d+)/);
  if (cellMatch) {
    return Number.parseInt(cellMatch[1], 10);
  }

  const rowMatch = (row.textContent || "").match(PLAYS_PATTERN);
  if (rowMatch) {
    return Number.parseInt(rowMatch[1], 10);
  }

  return 0;
}

function extractXmlNumPlays(item) {
  const playsText = readXmlValue(item.querySelector("numplays"));
  const parsed = Number.parseInt(playsText, 10);
  return Number.isFinite(parsed) ? parsed : 0;
}

function computeGamePayoff(game, costPerPlay) {
  const safeCost = costPerPlay > 0 ? costPerPlay : DEFAULT_COST_PER_PLAY;
  const numPlays = Number.isFinite(game.numPlays) ? game.numPlays : 0;
  const playsNeeded = Math.max(1, Math.ceil(game.amount / safeCost));
  const playsRemaining = Math.max(0, playsNeeded - numPlays);
  const valueRecovered = Math.min(game.amount, numPlays * safeCost);
  const valueRemaining = Math.max(0, game.amount - valueRecovered);
  const progressPercent = Math.min(100, (valueRecovered / game.amount) * 100);
  const isPaidOff = numPlays >= playsNeeded;

  return {
    numPlays,
    playsNeeded,
    playsRemaining,
    valueRecovered,
    valueRemaining,
    progressPercent,
    isPaidOff,
  };
}

function computePayoffSummary(games, costPerPlay) {
  const enrichedGames = games.map((game) => ({
    ...game,
    payoff: computeGamePayoff(game, costPerPlay),
  }));

  const paidOff = enrichedGames.filter((game) => game.payoff.isPaidOff);
  const notPaidOff = enrichedGames.filter((game) => !game.payoff.isPaidOff);

  const paidOffByCurrency = {};
  const remainingByCurrency = {};
  let totalPlaysRemaining = 0;

  for (const game of enrichedGames) {
    const currency = game.currency || "UNKNOWN";
    if (game.payoff.isPaidOff) {
      paidOffByCurrency[currency] = (paidOffByCurrency[currency] || 0) + game.amount;
    } else {
      remainingByCurrency[currency] = (remainingByCurrency[currency] || 0) + game.payoff.valueRemaining;
      totalPlaysRemaining += game.payoff.playsRemaining;
    }
  }

  return {
    games: enrichedGames,
    paidOff,
    notPaidOff,
    paidOffCount: paidOff.length,
    notPaidOffCount: notPaidOff.length,
    paidOffByCurrency,
    remainingByCurrency,
    totalPlaysRemaining,
    costPerPlay,
  };
}

function getDefaultPayoffSettings() {
  return {
    costPerPlay: DEFAULT_COST_PER_PLAY,
    currency: DEFAULT_COST_PER_PLAY_CURRENCY,
  };
}

function readXmlValue(node) {
  if (!node) {
    return "";
  }

  return (node.getAttribute("value") || node.textContent || "").trim();
}

function extractXmlItemName(item) {
  const nameNode = item.querySelector("name");
  const name = readXmlValue(nameNode);
  if (name) {
    return name;
  }

  const originalName = readXmlValue(item.querySelector("originalname"));
  if (originalName) {
    return originalName;
  }

  const objectId = item.getAttribute("objectid");
  if (objectId) {
    return `Game #${objectId}`;
  }

  return "Unknown game";
}

function extractNameFromRow(row) {
  const titleLink = row.querySelector("a[href*='/boardgame/'], a[href*='/boardgameexpansion/']");
  if (titleLink) {
    const linkText = titleLink.textContent?.replace(/\s+/g, " ").trim();
    if (linkText) {
      return linkText;
    }

    const ariaLabel = titleLink.getAttribute("aria-label")?.trim();
    if (ariaLabel) {
      return ariaLabel;
    }

    const title = titleLink.getAttribute("title")?.trim();
    if (title) {
      return title;
    }
  }

  const nameNode = row.querySelector(".collection-title, .primary_name, [class*='title']");
  const nodeText = nameNode?.textContent?.replace(/\s+/g, " ").trim();
  if (nodeText) {
    return nodeText;
  }

  const imgAlt = row.querySelector("img[alt]")?.getAttribute("alt")?.trim();
  if (imgAlt && !/^thumbnail$/i.test(imgAlt)) {
    return imgAlt;
  }

  const objectId = extractObjectIdFromRow(row);
  if (objectId) {
    return `Game #${objectId}`;
  }

  return "Unknown game";
}

function extractObjectIdFromHref(href) {
  if (!href) {
    return null;
  }
  const match = href.match(/\/(?:boardgame|boardgameexpansion)\/(\d+)/i);
  return match ? match[1] : null;
}

function extractObjectIdFromRow(row) {
  const link = row.querySelector("a[href*='/boardgame/'], a[href*='/boardgameexpansion/']");
  return extractObjectIdFromHref(link?.getAttribute("href"));
}

function extractThumbnailFromRow(row) {
  const img = row.querySelector("img[src*='geekdo'], img[src*='thumbnail'], img");
  const src = img?.getAttribute("src") || img?.getAttribute("data-src");
  return src || null;
}

function formatMoney(amount, currency) {
  if (currency && currency !== "UNKNOWN") {
    try {
      return new Intl.NumberFormat(undefined, {
        style: "currency",
        currency,
        maximumFractionDigits: 2,
      }).format(amount);
    } catch {
      // Fall through to plain formatting.
    }
  }

  return `${amount.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} ${currency || ""}`.trim();
}

function parsePricesFromCollectionXml(xmlText) {
  const doc = new DOMParser().parseFromString(xmlText, "text/xml");
  const parserError = doc.querySelector("parsererror");
  if (parserError) {
    throw new Error("Could not parse the BGG collection response.");
  }

  const games = [];
  let withoutPrice = 0;

  for (const item of doc.querySelectorAll("item")) {
    const objectId = item.getAttribute("objectid") || null;
    const name = extractXmlItemName(item);
    const thumbnail = readXmlValue(item.querySelector("thumbnail")) || null;
    const priceNode = item.querySelector("pricepaid");
    const currencyNode = item.querySelector("pp_currency");
    const rawPrice = readXmlValue(priceNode);
    const amount = parseAmount(rawPrice);
    const currency = normalizeCurrencyCode(readXmlValue(currencyNode));

    if (amount === null) {
      withoutPrice += 1;
      continue;
    }

    games.push({
      name,
      objectId,
      thumbnail,
      rawPrice,
      numPlays: extractXmlNumPlays(item),
      amount,
      currency: currency || "UNKNOWN",
    });
  }

  return finalizeGameList(games, withoutPrice);
}

function parsePricesFromDom(root = document) {
  const games = [];
  const seenRowKeys = new Set();
  let withoutPrice = 0;

  const rows = collectCollectionRows(root);

  for (const row of rows) {
    const rowKey = row.dataset?.bggRowKey || String(rows.indexOf(row));
    if (seenRowKeys.has(rowKey)) {
      continue;
    }
    seenRowKeys.add(rowKey);

    const rowText = row.textContent || "";
    if (!PRICE_PAID_PATTERN.test(rowText)) {
      continue;
    }

    const titleLink =
      row.querySelector("a[href*='/boardgame/'], a[href*='/boardgameexpansion/']") ||
      row.querySelector("a.primary, td.title a, .collection-title a");
    const name = extractNameFromRow(row);
    const objectId = extractObjectIdFromRow(row);
    const thumbnail = extractThumbnailFromRow(row);
    const priceMatch = rowText.match(PRICE_PAID_PATTERN);
    const rawPrice = priceMatch?.[1]?.trim() || "";
    const entry = parsePricePaidFromText(rowText);

    if (!entry) {
      withoutPrice += 1;
      continue;
    }

    games.push({
      name,
      objectId,
      thumbnail,
      rawPrice,
      numPlays: extractPlaysFromRow(row),
      ...entry,
    });
  }

  return finalizeGameList(games, withoutPrice);
}

function collectCollectionRows(root) {
  const rows = [];
  const seenElements = new Set();

  const addRow = (row) => {
    if (!row || seenElements.has(row)) {
      return;
    }
    seenElements.add(row);
    rows.push(row);
  };

  for (const row of root.querySelectorAll("table tbody tr")) {
    if (row.querySelector("a[href*='/boardgame/'], a[href*='/boardgameexpansion/']")) {
      addRow(row);
    }
  }

  if (rows.length === 0) {
    for (const row of root.querySelectorAll("[data-testid*='collection'] tr, tr.collection-item")) {
      if (row.querySelector("a[href*='/boardgame/'], a[href*='/boardgameexpansion/']")) {
        addRow(row);
      }
    }
  }

  if (rows.length === 0) {
    for (const item of root.querySelectorAll(".collectionitem, .collection-item, .geekcollection-item")) {
      if (PRICE_PAID_PATTERN.test(item.textContent || "")) {
        addRow(item);
      }
    }
  }

  return rows;
}

function findPrivateInfoColumnIndex(table) {
  const headers = table.querySelectorAll("thead th, thead td, tr th, [role='columnheader']");
  for (let index = 0; index < headers.length; index += 1) {
    if (/private\s*info/i.test(headers[index].textContent || "")) {
      return index;
    }
  }
  return -1;
}

function hasPrivateInfoOnPage(root = document) {
  if (PRICE_PAID_PATTERN.test(root.body?.textContent || "")) {
    return true;
  }

  const table = root.querySelector("table");
  return table ? findPrivateInfoColumnIndex(table) >= 0 : false;
}

function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function fetchOwnCollectionXml(username, pageFilters = {}) {
  const params = new URLSearchParams({
    username,
    showprivate: "1",
    own: "1",
    subtype: "boardgame",
  });

  if (pageFilters.own === "1") {
    params.set("own", "1");
  }
  if (pageFilters.subtype) {
    params.set("subtype", pageFilters.subtype);
  }

  let delayMs = 2000;
  for (let attempt = 0; attempt < 12; attempt += 1) {
    const response = await fetch(
      `https://boardgamegeek.com/xmlapi2/collection?${params.toString()}`,
      { credentials: "include" },
    );

    if (response.status === 202) {
      await sleep(delayMs);
      delayMs = Math.min(delayMs + 1000, 10000);
      continue;
    }

    if (!response.ok) {
      throw new Error(`BGG API returned HTTP ${response.status}.`);
    }

    return response.text();
  }

  throw new Error("BGG is still preparing your collection. Please try again in a few seconds.");
}

function extractUsernameFromUrl(url) {
  const match = url.match(/\/collection\/user\/([^/?#]+)/i);
  return match ? decodeURIComponent(match[1]) : null;
}

function getLoggedInUsername() {
  const cookieMatch = document.cookie.match(/(?:^|;\s*)bgg_username=([^;]+)/);
  if (cookieMatch) {
    return decodeURIComponent(cookieMatch[1]);
  }

  const profileLink = document.querySelector(
    "a[href*='/user/'][href*='logged-in'], .avatar-menu a[href*='/user/'], .header-user a[href*='/user/']",
  );
  if (profileLink) {
    const hrefMatch = profileLink.getAttribute("href")?.match(/\/user\/([^/?#]+)/i);
    if (hrefMatch) {
      return decodeURIComponent(hrefMatch[1]);
    }
  }

  return null;
}

function readPageFilters() {
  const params = new URLSearchParams(window.location.search);
  return {
    own: params.get("own") || "1",
    subtype: params.get("subtype") || "boardgame",
  };
}

async function calculatePricePaidTotal() {
  const pageUrl = window.location.href;
  if (!/\/collection\/user\//i.test(pageUrl)) {
    throw new Error("Open your BGG collection page before running this extension.");
  }

  const collectionUsername = extractUsernameFromUrl(pageUrl);
  const loggedInUsername = getLoggedInUsername();
  const pageFilters = readPageFilters();
  const isOwnCollection =
    collectionUsername &&
    loggedInUsername &&
    collectionUsername.toLowerCase() === loggedInUsername.toLowerCase();

  let source = "dom";
  let result = parsePricesFromDom(document);

  if (isOwnCollection) {
    try {
      const xml = await fetchOwnCollectionXml(collectionUsername, pageFilters);
      const apiResult = parsePricesFromCollectionXml(xml);
      if (apiResult.withPrice > 0 || result.withPrice === 0) {
        result = apiResult;
        source = "api";
      }
    } catch (error) {
      if (result.withPrice === 0) {
        throw error;
      }
      result.warning = `Could not load the full collection from BGG (${error.message}). Showing prices found on the current page only.`;
      source = "dom-partial";
    }
  } else if (result.withPrice === 0) {
    throw new Error(
      "No Price Paid values were found. Make sure the Private Info column is visible, or open your own collection while logged in.",
    );
  } else {
    result.warning =
      "You are viewing someone else's collection. Only games visible on this page were counted.";
    source = "dom-partial";
  }

  if (result.withPrice === 0) {
    throw new Error(
      "No Price Paid values were found. Add prices in the Private Info column for your owned games, then try again.",
    );
  }

  return {
    ...result,
    source,
    collectionUsername,
    isOwnCollection,
    privateInfoVisible: hasPrivateInfoOnPage(document),
  };
}

if (typeof globalThis !== "undefined") {
  globalThis.BggPriceParser = {
    calculatePricePaidTotal,
    parsePricePaidFromText,
    parseMoneyValue,
    formatMoney,
    addToTotals,
    totalsFromGames,
    dedupeGames,
    finalizeGameList,
    computeGamePayoff,
    computePayoffSummary,
    getDefaultPayoffSettings,
    SETTINGS_KEY,
    DEFAULT_COST_PER_PLAY,
    DEFAULT_COST_PER_PLAY_CURRENCY,
  };
}
