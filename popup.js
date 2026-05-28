const STORAGE_KEY = "bggPricePaidReport";

const statusEl = document.getElementById("status");
const resultsEl = document.getElementById("results");
const totalsEl = document.getElementById("totals");
const withPriceEl = document.getElementById("with-price");
const withoutPriceEl = document.getElementById("without-price");
const sourceEl = document.getElementById("source");
const warningEl = document.getElementById("warning");
const openReportEl = document.getElementById("open-report");

let latestResult = null;

function showError(message) {
  statusEl.textContent = message;
  statusEl.className = "status error";
  resultsEl.classList.add("hidden");
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
      return source;
  }
}

function renderTotals(totals) {
  totalsEl.innerHTML = "";
  const entries = Object.entries(totals).sort(([left], [right]) => left.localeCompare(right));

  for (const [currency, amount] of entries) {
    const card = document.createElement("article");
    card.className = "total-card";
    card.innerHTML = `
      <div class="label">${currency === "UNKNOWN" ? "Unspecified currency" : currency}</div>
      <div class="amount">${BggPriceParser.formatMoney(amount, currency)}</div>
    `;
    totalsEl.appendChild(card);
  }
}

async function saveAndOpenReport(result) {
  await chrome.storage.local.set({
    [STORAGE_KEY]: {
      ...result,
      generatedAt: new Date().toISOString(),
    },
  });

  await chrome.tabs.create({ url: chrome.runtime.getURL("report.html") });
}

function renderResult(result) {
  latestResult = result;
  statusEl.classList.add("hidden");
  resultsEl.classList.remove("hidden");
  openReportEl.classList.remove("hidden");
  renderTotals(result.totals);
  withPriceEl.textContent = String(result.withPrice);
  withoutPriceEl.textContent = String(result.withoutPrice);
  sourceEl.textContent = sourceLabel(result.source);

  const warnings = [];
  if (result.warning) {
    warnings.push(result.warning);
  }
  if (result.duplicatesRemoved > 0) {
    warnings.push(`${result.duplicatesRemoved} duplicate entries were removed.`);
  }
  if (!result.privateInfoVisible && result.source === "api") {
    warnings.push("Full collection loaded from BGG API.");
  }

  if (warnings.length) {
    warningEl.textContent = warnings.join(" ");
    warningEl.classList.remove("hidden");
  } else {
    warningEl.classList.add("hidden");
  }

  saveAndOpenReport(result);
}

async function ensureContentScript(tabId) {
  try {
    await chrome.tabs.sendMessage(tabId, { type: "PING" });
    return;
  } catch {
    // Content script may not be loaded yet (e.g. page opened before install).
  }

  if (!chrome.scripting?.executeScript) {
    throw new Error("Reload the BGG collection page, then open the extension again.");
  }

  await chrome.scripting.executeScript({
    target: { tabId },
    files: ["price-parser.js", "content.js"],
  });
}

async function run() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id || !tab.url?.includes("boardgamegeek.com/collection/")) {
    showError("Open a BoardGameGeek collection page, then click the extension again.");
    return;
  }

  try {
    await ensureContentScript(tab.id);
    const response = await chrome.tabs.sendMessage(tab.id, {
      type: "CALCULATE_PRICE_PAID_TOTAL",
    });

    if (!response?.ok) {
      showError(response?.error || "Could not calculate the total.");
      return;
    }

    renderResult(response.result);
  } catch (error) {
    showError(error instanceof Error ? error.message : "Unexpected error while calculating totals.");
  }
}

openReportEl.addEventListener("click", () => {
  if (latestResult) {
    saveAndOpenReport(latestResult);
  }
});

run();
