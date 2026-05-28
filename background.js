chrome.action.onClicked.addListener(async (tab) => {
  if (!tab.id || !tab.url?.includes("boardgamegeek.com/collection/")) {
    return;
  }

  await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    files: ["price-parser.js", "content.js"],
  });
});
