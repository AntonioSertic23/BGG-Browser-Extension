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
  const table = row.closest("table");
  if (table) {
    const playsColumnIndex = findPlaysColumnIndex(table);
    if (playsColumnIndex >= 0) {
      const cell = row.children[playsColumnIndex];
      const cellText = cell?.textContent?.trim() || "";
      const exactMatch = cellText.match(/^(\d+)$/);
      if (exactMatch) {
        return Number.parseInt(exactMatch[1], 10);
      }
      const looseMatch = cellText.match(/(\d+)/);
      if (looseMatch) {
        return Number.parseInt(looseMatch[1], 10);
      }
    }
  }

  const playsCell = row.querySelector(
    "[class*='plays'], [data-column='plays'], td.plays, [aria-label*='Plays']",
  );
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

function findPlaysColumnIndex(table) {
  const headers = table.querySelectorAll("thead th, thead td, tr th, [role='columnheader']");
  for (let index = 0; index < headers.length; index += 1) {
    const label = headers[index].textContent?.trim() || "";
    if (/your\s+plays|^plays$/i.test(label)) {
      return index;
    }
  }
  return -1;
}

function extractXmlNumPlays(item) {
  const playsText = readXmlValue(item.querySelector("numplays"));
  const parsed = Number.parseInt(playsText, 10);
  return Number.isFinite(parsed) ? parsed : 0;
}

function computeGamePayoff(game, costPerPlay) {
  const safeCost = costPerPlay > 0 ? costPerPlay : DEFAULT_COST_PER_PLAY;
  const basePlays = Number.isFinite(game.basePlays) ? game.basePlays : Number.isFinite(game.numPlays) ? game.numPlays : 0;
  const linkedExpansionPlays = Number.isFinite(game.linkedExpansionPlays) ? game.linkedExpansionPlays : 0;
  const effectivePlays = Number.isFinite(game.effectivePlays) ? game.effectivePlays : basePlays + linkedExpansionPlays;
  const playsNeeded = Math.max(1, Math.ceil(game.amount / safeCost));
  const playsRemaining = Math.max(0, playsNeeded - effectivePlays);
  const valueRecovered = Math.min(game.amount, effectivePlays * safeCost);
  const valueRemaining = Math.max(0, game.amount - valueRecovered);
  const progressPercent = Math.min(100, (valueRecovered / game.amount) * 100);
  const isPaidOff = effectivePlays >= playsNeeded;

  return {
    numPlays: basePlays,
    linkedExpansionPlays,
    effectivePlays,
    playsNeeded,
    playsRemaining,
    valueRecovered,
    valueRemaining,
    progressPercent,
    isPaidOff,
  };
}

function normalizeGameName(name) {
  if (!name) {
    return "Unknown game";
  }

  return name
    .replace(/^Board\s+Game\s*:\s*/i, "")
    .replace(/^Boardgame\s*:\s*/i, "")
    .trim();
}

function formatPlaysBreakdown(payoff) {
  if (payoff.linkedExpansionPlays > 0) {
    return `${payoff.numPlays} base + ${payoff.linkedExpansionPlays} from expansions = ${payoff.effectivePlays} total`;
  }

  return `${payoff.effectivePlays} play${payoff.effectivePlays === 1 ? "" : "s"}`;
}

function formatPlaysBreakdownHtml(payoff) {
  if (payoff.linkedExpansionPlays > 0) {
    return `${payoff.numPlays} base + ${payoff.linkedExpansionPlays} from expansions = <span class="plays-total">${payoff.effectivePlays}</span> total plays`;
  }

  return `<span class="plays-total">${payoff.effectivePlays}</span> play${payoff.effectivePlays === 1 ? "" : "s"}`;
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
    return normalizeGameName(name);
  }

  const originalName = readXmlValue(item.querySelector("originalname"));
  if (originalName) {
    return normalizeGameName(originalName);
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
      return normalizeGameName(linkText);
    }

    const ariaLabel = titleLink.getAttribute("aria-label")?.trim();
    if (ariaLabel) {
      return normalizeGameName(ariaLabel);
    }

    const title = titleLink.getAttribute("title")?.trim();
    if (title) {
      return normalizeGameName(title);
    }
  }

  const nameNode = row.querySelector(".collection-title, .primary_name, [class*='title']");
  const nodeText = nameNode?.textContent?.replace(/\s+/g, " ").trim();
  if (nodeText) {
    return normalizeGameName(nodeText);
  }

  const imgAlt = row.querySelector("img[alt]")?.getAttribute("alt")?.trim();
  if (imgAlt && !/^thumbnail$/i.test(imgAlt)) {
    return normalizeGameName(imgAlt);
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

function applyLinkedPlaysToGames(games) {
  for (const game of games) {
    const linkedExpansions = game.linkedExpansions || [];
    game.basePlays = game.numPlays;
    game.linkedExpansionPlays = linkedExpansions.reduce((sum, expansion) => sum + expansion.numPlays, 0);
    game.effectivePlays = game.numPlays + game.linkedExpansionPlays;
  }
}

function extractPrivateInfoTextFromRow(row) {
  const table = row.closest("table");
  if (table) {
    const privateInfoColumnIndex = findPrivateInfoColumnIndex(table);
    if (privateInfoColumnIndex >= 0) {
      return row.children[privateInfoColumnIndex]?.textContent || "";
    }
  }

  const privateInfoCell = row.querySelector(
    "[class*='private'], [data-column='private'], td.privateinfo, [aria-label*='Private']",
  );
  if (privateInfoCell) {
    return privateInfoCell.textContent || "";
  }

  return row.textContent || "";
}

function isLikelyExpansionRow(row) {
  if (row.querySelector("a[href*='/boardgameexpansion/']")) {
    return true;
  }

  const className = row.className || "";
  if (/expansion|boardgameexpansion|collectionitem_expansion/i.test(className)) {
    return true;
  }

  const rowText = row.textContent || "";
  if (/\bexpansion for\b|\bexpansion\b/i.test(rowText)) {
    return true;
  }

  return row.closest("[class*='expansion']") !== null;
}

function parseRowFromDom(row) {
  const privateInfoText = extractPrivateInfoTextFromRow(row);
  const priceEntry = parsePricePaidFromText(privateInfoText);
  const priceMatch = privateInfoText.match(PRICE_PAID_PATTERN);

  return {
    name: extractNameFromRow(row),
    objectId: extractObjectIdFromRow(row),
    thumbnail: extractThumbnailFromRow(row),
    rawPrice: priceMatch?.[1]?.trim() || "",
    numPlays: extractPlaysFromRow(row),
    isExpansion: isLikelyExpansionRow(row),
    amount: priceEntry?.amount ?? null,
    currency: priceEntry?.currency || "UNKNOWN",
  };
}

function parseCollectionFromDom(root = document) {
  const rows = collectCollectionRows(root);
  const pricedGames = [];
  const unpricedExpansions = [];
  let currentBase = null;
  let withoutPrice = 0;

  for (const row of rows) {
    const item = parseRowFromDom(row);

    if (item.amount !== null) {
      currentBase = {
        name: item.name,
        objectId: item.objectId,
        thumbnail: item.thumbnail,
        rawPrice: item.rawPrice,
        numPlays: item.numPlays,
        amount: item.amount,
        currency: item.currency,
        linkedExpansions: [],
      };
      pricedGames.push(currentBase);
      continue;
    }

    if (currentBase) {
      const expansionEntry = {
        name: item.name,
        objectId: item.objectId,
        thumbnail: item.thumbnail,
        numPlays: item.numPlays,
      };

      currentBase.linkedExpansions.push(expansionEntry);
      unpricedExpansions.push({
        ...expansionEntry,
        linkedBaseId: currentBase.objectId,
        linkedBaseName: currentBase.name,
        rollsUpToBase: true,
      });
      withoutPrice += 1;
      continue;
    }

    unpricedExpansions.push({
      name: item.name,
      objectId: item.objectId,
      thumbnail: item.thumbnail,
      numPlays: item.numPlays,
      linkedBaseId: null,
      linkedBaseName: null,
      rollsUpToBase: false,
    });
    withoutPrice += 1;
  }

  applyLinkedPlaysToGames(pricedGames);

  const result = finalizeGameList(pricedGames, withoutPrice);
  result.unpricedExpansions = unpricedExpansions;
  result.expansionPlaysRolledUp = pricedGames.reduce(
    (sum, game) => sum + (game.linkedExpansionPlays || 0),
    0,
  );

  return result;
}

function mergeExpansionRollupFromDom(apiResult, domResult) {
  const domById = new Map(
    domResult.games.filter((game) => game.objectId).map((game) => [String(game.objectId), game]),
  );
  const domByName = new Map(
    domResult.games.map((game) => [game.name.trim().toLowerCase(), game]),
  );

  for (const game of apiResult.games) {
    const domGame =
      domById.get(String(game.objectId)) || domByName.get(game.name.trim().toLowerCase());
    if (!domGame?.linkedExpansions?.length) {
      continue;
    }

    game.linkedExpansions = domGame.linkedExpansions.map((expansion) => ({ ...expansion }));
    game.basePlays = game.numPlays;
    game.linkedExpansionPlays = game.linkedExpansions.reduce(
      (sum, expansion) => sum + expansion.numPlays,
      0,
    );
    game.effectivePlays = game.numPlays + game.linkedExpansionPlays;
  }

  apiResult.unpricedExpansions = domResult.unpricedExpansions;
  apiResult.expansionPlaysRolledUp = apiResult.games.reduce(
    (sum, game) => sum + (game.linkedExpansionPlays || 0),
    0,
  );
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
  return parseCollectionFromDom(root);
}

const SIDEBAR_SELECTOR =
  "aside, [role='complementary'], nav, header, .header, #navbar, .global-nav, " +
  "#hotness, .hotness, [class*='hotness'], [class*='minipanel'], [class*='sidebar'], " +
  "[id*='hotness'], [id*='sidebar'], [class*='recently'], [id*='recently'], " +
  "[class*='trending'], [id*='trending']";

function isExcludedSidebarElement(element) {
  return Boolean(element?.closest(SIDEBAR_SELECTOR));
}

function getCollectionHeaderText(table) {
  return Array.from(table.querySelectorAll("thead th, thead td, tr th, [role='columnheader']"))
    .map((cell) => cell.textContent?.trim() || "")
    .join(" ");
}

function isCollectionTable(table) {
  if (!table || isExcludedSidebarElement(table)) {
    return false;
  }

  const headerText = getCollectionHeaderText(table);
  const hasCollectionColumns =
    /private\s*info/i.test(headerText) ||
    /user\s+plays/i.test(headerText) ||
    (/title/i.test(headerText) && /geek\s+rating|status|version/i.test(headerText));

  if (!hasCollectionColumns) {
    return false;
  }

  return Boolean(
    table.querySelector(
      "tbody a[href*='/boardgame/'], tbody a[href*='/boardgameexpansion/'], " +
        "tr a[href*='/boardgame/'], tr a[href*='/boardgameexpansion/']",
    ),
  );
}

function findCollectionTable(root) {
  const containerSelectors = [
    "#colresults",
    "#collection_results",
    "#results_table",
    "#collection_table",
    "[id*='collection'][id*='result']",
  ];

  for (const selector of containerSelectors) {
    const container = root.querySelector(selector);
    if (!container || isExcludedSidebarElement(container)) {
      continue;
    }

    const table =
      container.tagName === "TABLE" ? container : container.querySelector("table");
    if (table && isCollectionTable(table)) {
      return table;
    }
  }

  for (const table of root.querySelectorAll("table.collection, table")) {
    if (isCollectionTable(table)) {
      return table;
    }
  }

  return null;
}

function findCollectionListContainer(root) {
  const table = findCollectionTable(root);
  if (table) {
    return table;
  }

  const containerSelectors = ["#colresults", "#collection_results", "#results_table"];
  for (const selector of containerSelectors) {
    const container = root.querySelector(selector);
    if (container && !isExcludedSidebarElement(container)) {
      return container;
    }
  }

  return null;
}

function collectCollectionRows(root) {
  const rows = [];
  const seenElements = new Set();
  const collectionTable = findCollectionTable(root);

  const addRow = (row) => {
    if (!row || seenElements.has(row) || isExcludedSidebarElement(row)) {
      return;
    }

    seenElements.add(row);
    rows.push(row);
  };

  if (collectionTable) {
    for (const row of collectionTable.querySelectorAll("tbody tr")) {
      if (row.querySelector("a[href*='/boardgame/'], a[href*='/boardgameexpansion/']")) {
        addRow(row);
      }
    }
  }

  if (rows.length === 0) {
    const collectionContainer = findCollectionListContainer(root);
    if (collectionContainer) {
      for (const row of collectionContainer.querySelectorAll(
        "[class*='collection-item'], [class*='collectionitem'], .geekcollection-item",
      )) {
        if (row.querySelector("a[href*='/boardgame/'], a[href*='/boardgameexpansion/']")) {
          addRow(row);
        }
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
  const table = findCollectionTable(root);
  if (table) {
    if (PRICE_PAID_PATTERN.test(table.textContent || "")) {
      return true;
    }
    return findPrivateInfoColumnIndex(table) >= 0;
  }

  const collectionContainer = findCollectionListContainer(root);
  if (collectionContainer && PRICE_PAID_PATTERN.test(collectionContainer.textContent || "")) {
    return true;
  }

  return false;
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
  const domResult = parseCollectionFromDom(document);
  let result = domResult;

  if (isOwnCollection) {
    try {
      const xml = await fetchOwnCollectionXml(collectionUsername, pageFilters);
      const apiResult = parsePricesFromCollectionXml(xml);
      mergeExpansionRollupFromDom(apiResult, domResult);
      if (apiResult.withPrice > 0 || domResult.withPrice === 0) {
        result = apiResult;
        source = "api";
      }
    } catch (error) {
      if (result.withPrice === 0) {
        throw error;
      }
      mergeExpansionRollupFromDom(result, domResult);
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
    formatPlaysBreakdown,
    formatPlaysBreakdownHtml,
    normalizeGameName,
    getDefaultPayoffSettings,
    SETTINGS_KEY,
    DEFAULT_COST_PER_PLAY,
    DEFAULT_COST_PER_PLAY_CURRENCY,
  };
}
