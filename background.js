chrome.storage.onChanged.addListener(() => {
  chrome.storage.sync.get(null, state => {
    if (!state || typeof state.remainingDays !== "number") return;
    chrome.action.setBadgeText({ text: String(state.remainingDays) });
    chrome.action.setBadgeBackgroundColor({ color: "#b00020" });
  });
});
