const STORAGE_KEY = "bggPricePaidReport";

const statusEl = document.getElementById("status");
const subtitleEl = document.getElementById("subtitle");
const summaryTotalsEl = document.getElementById("summary-totals");
const settingsEl = document.getElementById("settings");
const payoffSummaryEl = document.getElementById("payoff-summary");
const controlsEl = document.getElementById("controls");
const noticeEl = document.getElementById("notice");
const gamesEl = document.getElementById("games");
const expansionsPanelEl = document.getElementById("expansions-panel");
const expansionsDetailsEl = document.getElementById("expansions-details");
const expansionsSummaryCountEl = document.getElementById("expansions-summary-count");
const expansionsListEl = document.getElementById("expansions-list");
const verifyEl = document.getElementById("verify");
const searchEl = document.getElementById("search");
const sortEl = document.getElementById("sort");
const viewFilterEl = document.getElementById("view-filter");
const costPerPlayEl = document.getElementById("cost-per-play");
const costCurrencyEl = document.getElementById("cost-currency");

let reportData = null;
let payoffSummary = null;
let payoffSettings = BggPriceParser.getDefaultPayoffSettings();

function showError(message) {
  statusEl.textContent = message;
  statusEl.className = "status error";
  settingsEl.classList.add("hidden");
  payoffSummaryEl.classList.add("hidden");
  controlsEl.classList.add("hidden");
  gamesEl.classList.add("hidden");
  expansionsPanelEl.classList.add("hidden");
  verifyEl.classList.add("hidden");
}

function sourceLabel(source) {
  switch (source) {
    case "api":
      return "Full collection (BGG API)";
    case "dom":
      return "Current page (Private Info column)";
    case "dom-partial":
      return "Current page only";
    default:
      return source || "Unknown";
  }
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function formatCurrencyTotals(totals) {
  return Object.entries(totals)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([currency, amount]) => BggPriceParser.formatMoney(amount, currency))
    .join(" · ");
}

function renderSummaryTotals(totals) {
  summaryTotalsEl.innerHTML = "";
  const entries = Object.entries(totals).sort(([a], [b]) => a.localeCompare(b));

  for (const [currency, amount] of entries) {
    const card = document.createElement("article");
    card.className = "summary-card";
    card.innerHTML = `
      <div class="label">${currency === "UNKNOWN" ? "Unspecified currency" : currency} spent</div>
      <div class="amount">${BggPriceParser.formatMoney(amount, currency)}</div>
    `;
    summaryTotalsEl.appendChild(card);
  }
}

function renderPayoffSummary() {
  payoffSummary = BggPriceParser.computePayoffSummary(reportData.games, payoffSettings.costPerPlay);
  payoffSummaryEl.innerHTML = "";

  const cards = [
    {
      label: "Paid off",
      value: `${payoffSummary.paidOffCount} games`,
      detail: formatCurrencyTotals(payoffSummary.paidOffByCurrency) || "—",
      tone: "good",
    },
    {
      label: "Not paid off",
      value: `${payoffSummary.notPaidOffCount} games`,
      detail: formatCurrencyTotals(payoffSummary.remainingByCurrency) || "—",
      tone: "warn",
    },
    {
      label: "Plays still needed",
      value: String(payoffSummary.totalPlaysRemaining),
      detail: `at ${BggPriceParser.formatMoney(payoffSettings.costPerPlay, payoffSettings.currency)} per play`,
      tone: "neutral",
    },
  ];

  for (const card of cards) {
    const article = document.createElement("article");
    article.className = `payoff-card payoff-card-${card.tone}`;
    article.innerHTML = `
      <div class="label">${card.label}</div>
      <div class="value">${escapeHtml(card.value)}</div>
      <div class="detail">${escapeHtml(card.detail)}</div>
    `;
    payoffSummaryEl.appendChild(article);
  }
}

function renderThumb(game) {
  if (game.thumbnail) {
    const img = document.createElement("img");
    img.className = "game-thumb";
    img.src = game.thumbnail;
    img.alt = "";
    img.loading = "lazy";
    img.referrerPolicy = "no-referrer";
    img.onerror = () => {
      img.replaceWith(createPlaceholder());
    };
    return img;
  }
  return createPlaceholder();
}

function createPlaceholder() {
  const div = document.createElement("div");
  div.className = "game-thumb placeholder";
  div.textContent = "No image";
  return div;
}

function getFilteredGames() {
  const query = searchEl.value.trim().toLowerCase();
  let games = payoffSummary.games;

  switch (viewFilterEl.value) {
    case "paid-off":
      games = payoffSummary.paidOff;
      break;
    case "not-paid-off":
      games = payoffSummary.notPaidOff;
      break;
    default:
      games = payoffSummary.games;
  }

  if (query) {
    games = games.filter((game) => game.name.toLowerCase().includes(query));
  }

  const sorted = [...games];
  switch (sortEl.value) {
    case "plays-remaining-desc":
      sorted.sort(
        (a, b) =>
          b.payoff.playsRemaining - a.payoff.playsRemaining || a.name.localeCompare(b.name),
      );
      break;
    case "progress-desc":
      sorted.sort(
        (a, b) => b.payoff.progressPercent - a.payoff.progressPercent || a.name.localeCompare(b.name),
      );
      break;
    case "progress-asc":
      sorted.sort(
        (a, b) => a.payoff.progressPercent - b.payoff.progressPercent || a.name.localeCompare(b.name),
      );
      break;
    case "price-desc":
      sorted.sort((a, b) => b.amount - a.amount || a.name.localeCompare(b.name));
      break;
    case "price-asc":
      sorted.sort((a, b) => a.amount - b.amount || a.name.localeCompare(b.name));
      break;
    default:
      sorted.sort((a, b) => a.name.localeCompare(b.name));
  }

  return sorted;
}

function renderProgressBar(percent, isPaidOff) {
  const bar = document.createElement("div");
  bar.className = "progress-track";
  bar.innerHTML = `<div class="progress-fill ${isPaidOff ? "paid-off" : ""}" style="width: ${percent}%"></div>`;
  return bar;
}

function displayName(name) {
  return BggPriceParser.normalizeGameName(name);
}

function renderLinkedExpansions(game) {
  if (!game.linkedExpansions?.length) {
    return null;
  }

  const list = document.createElement("ul");
  list.className = "linked-expansions";

  for (const expansion of game.linkedExpansions) {
    const item = document.createElement("li");
    item.innerHTML = `
      <span class="linked-expansion-name">${escapeHtml(displayName(expansion.name))}</span>
      <span class="linked-expansion-plays">${expansion.numPlays} play${expansion.numPlays === 1 ? "" : "s"}</span>
    `;
    list.appendChild(item);
  }

  return list;
}

function renderExpansionsPanel() {
  const expansions = reportData.unpricedExpansions || [];
  expansionsListEl.innerHTML = "";

  if (expansions.length === 0) {
    expansionsPanelEl.classList.add("hidden");
    return;
  }

  expansionsPanelEl.classList.remove("hidden");
  expansionsDetailsEl.open = false;
  expansionsSummaryCountEl.textContent = `${expansions.length} item${expansions.length === 1 ? "" : "s"}`;

  for (const expansion of expansions) {
    const row = document.createElement("article");
    row.className = "expansion-row";

    const linkedText = expansion.rollsUpToBase
      ? displayName(expansion.linkedBaseName)
      : "Not linked to a priced base game in your collection";

    const info = document.createElement("div");
    info.className = "expansion-info";
    info.innerHTML = `
      <div class="expansion-name">${escapeHtml(displayName(expansion.name))}</div>
      <div class="expansion-meta">${expansion.numPlays} play${expansion.numPlays === 1 ? "" : "s"} · ${escapeHtml(linkedText)}</div>
    `;

    const badge = document.createElement("span");
    badge.className = `badge ${expansion.rollsUpToBase ? "badge-neutral" : "badge-muted"}`;
    badge.textContent = expansion.rollsUpToBase ? "Rolled up" : "Standalone";

    row.appendChild(renderThumb(expansion));
    row.appendChild(info);
    row.appendChild(badge);
    expansionsListEl.appendChild(row);
  }
}

function renderGames() {
  const games = getFilteredGames();
  gamesEl.innerHTML = "";

  if (games.length === 0) {
    gamesEl.innerHTML = '<div class="empty-state">No games match the current filters.</div>';
    return;
  }

  for (const game of games) {
    const row = document.createElement("article");
    row.className = `game-row ${game.payoff.isPaidOff ? "is-paid-off" : "is-not-paid-off"}`;

    const info = document.createElement("div");
    info.className = "game-info";

    const statusText = game.payoff.isPaidOff
      ? `<span class="badge badge-good">Paid off</span>`
      : `<span class="badge badge-warn">${game.payoff.playsRemaining} play${game.payoff.playsRemaining === 1 ? "" : "s"} to go</span>`;

    const playsText = BggPriceParser.formatPlaysBreakdownHtml(game.payoff);
    const metaText = game.payoff.isPaidOff
      ? `${BggPriceParser.formatMoney(game.amount, game.currency)} · ${playsText}`
      : `${BggPriceParser.formatMoney(game.amount, game.currency)} · ${playsText} · ${game.payoff.playsRemaining} more to break even`;

    info.innerHTML = `
      <div class="game-topline">
        <div class="game-name">${escapeHtml(displayName(game.name))}</div>
        ${statusText}
      </div>
      <div class="game-meta">${metaText}</div>
    `;

    const linkedExpansions = renderLinkedExpansions(game);
    if (linkedExpansions) {
      info.appendChild(linkedExpansions);
    }

    info.appendChild(renderProgressBar(game.payoff.progressPercent, game.payoff.isPaidOff));

    const side = document.createElement("div");
    side.className = "game-side";
    side.innerHTML = `
      <div class="game-price">${BggPriceParser.formatMoney(game.amount, game.currency)}</div>
      <div class="game-side-meta">${Math.round(game.payoff.progressPercent)}% recovered</div>
    `;

    row.appendChild(renderThumb(game));
    row.appendChild(info);
    row.appendChild(side);
    gamesEl.appendChild(row);
  }
}

function renderVerify() {
  const recomputed = BggPriceParser.totalsFromGames(reportData.games);
  const lines = [
    `<strong>Verification</strong>`,
    `${reportData.games.length} priced games in this report.`,
    `${payoffSummary.paidOffCount} paid off · ${payoffSummary.notPaidOffCount} not paid off.`,
    `Cost per play: ${BggPriceParser.formatMoney(payoffSettings.costPerPlay, payoffSettings.currency)}.`,
    `Data source: ${sourceLabel(reportData.source)}.`,
  ];

  if (reportData.duplicatesRemoved > 0) {
    lines.push(`${reportData.duplicatesRemoved} duplicate entries were removed before calculating totals.`);
  }

  for (const [currency, amount] of Object.entries(recomputed).sort(([a], [b]) => a.localeCompare(b))) {
    const shown = reportData.totals[currency] || 0;
    const match = Math.abs(shown - amount) < 0.01;
    lines.push(
      `${currency}: listed games sum to ${BggPriceParser.formatMoney(amount, currency)}` +
        (match ? " (matches header total)" : ` — header shows ${BggPriceParser.formatMoney(shown, currency)}`),
    );
  }

  if (reportData.expansionPlaysRolledUp > 0) {
    lines.push(`${reportData.expansionPlaysRolledUp} expansion plays were counted toward priced base games.`);
  }

  if (reportData.warning) {
    lines.push(`Note: ${reportData.warning}`);
  }

  verifyEl.innerHTML = lines.map((line) => `<div>${line}</div>`).join("");
}

function renderReport(data) {
  reportData = data;
  statusEl.classList.add("hidden");
  settingsEl.classList.remove("hidden");
  payoffSummaryEl.classList.remove("hidden");
  controlsEl.classList.remove("hidden");
  gamesEl.classList.remove("hidden");
  verifyEl.classList.remove("hidden");

  const user = data.collectionUsername ? `@${data.collectionUsername}` : "your collection";
  const expansionNote =
    data.expansionPlaysRolledUp > 0 ? ` · ${data.expansionPlaysRolledUp} expansion plays rolled up` : "";
  subtitleEl.textContent = `${user} · ${data.games.length} priced games${expansionNote}`;

  renderSummaryTotals(data.totals);
  renderPayoffSummary();
  renderGames();
  renderExpansionsPanel();
  renderVerify();

  const notices = [];
  if (data.warning) notices.push(data.warning);
  if (data.duplicatesRemoved > 0) notices.push(`${data.duplicatesRemoved} duplicates removed.`);
  if ((data.expansionPlaysRolledUp || 0) > 0) {
    notices.push(
      "Unpriced rows listed after a base game on this page had their plays added to that base game.",
    );
  } else if (data.source === "api") {
    notices.push(
      "Expansion play rollup uses the collection page layout. Make sure the base game and its unpriced expansions are visible together on the page.",
    );
  }
  if (notices.length) {
    noticeEl.classList.remove("hidden");
    noticeEl.textContent = notices.join(" ");
  } else {
    noticeEl.classList.add("hidden");
  }
}

async function loadSettings() {
  const stored = await chrome.storage.local.get(BggPriceParser.SETTINGS_KEY);
  payoffSettings = {
    ...BggPriceParser.getDefaultPayoffSettings(),
    ...(stored[BggPriceParser.SETTINGS_KEY] || {}),
  };

  costPerPlayEl.value = String(payoffSettings.costPerPlay);
  costCurrencyEl.value = payoffSettings.currency;
}

async function saveSettings() {
  await chrome.storage.local.set({
    [BggPriceParser.SETTINGS_KEY]: payoffSettings,
  });
}

function applySettingsFromInputs() {
  const parsedCost = Number.parseFloat(costPerPlayEl.value);
  payoffSettings = {
    costPerPlay: Number.isFinite(parsedCost) && parsedCost > 0 ? parsedCost : BggPriceParser.DEFAULT_COST_PER_PLAY,
    currency: costCurrencyEl.value || BggPriceParser.DEFAULT_COST_PER_PLAY_CURRENCY,
  };

  saveSettings();

  if (reportData) {
    renderPayoffSummary();
    renderGames();
    renderExpansionsPanel();
    renderVerify();
  }
}

async function loadReport() {
  await loadSettings();

  const stored = await chrome.storage.local.get(STORAGE_KEY);
  const data = stored[STORAGE_KEY];

  if (!data?.games?.length) {
    showError("No report data found. Open your BGG collection and run the extension again.");
    return;
  }

  renderReport(data);
}

costPerPlayEl.addEventListener("input", applySettingsFromInputs);
costCurrencyEl.addEventListener("change", applySettingsFromInputs);
searchEl.addEventListener("input", renderGames);
sortEl.addEventListener("change", renderGames);
viewFilterEl.addEventListener("change", renderGames);
loadReport();
