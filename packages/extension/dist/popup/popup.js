(function() {
  "use strict";
  document.addEventListener("DOMContentLoaded", async () => {
    const settings = await chrome.storage.sync.get({
      enabled: true,
      filterLevel: "moderate",
      showBadges: true,
      showAlternatives: true
    });
    document.getElementById("enableToggle").checked = settings.enabled;
    document.getElementById("filterLevel").value = settings.filterLevel;
    document.getElementById("showBadges").checked = settings.showBadges;
    document.getElementById("showAlternatives").checked = settings.showAlternatives;
    document.getElementById("enableToggle").addEventListener("change", async (e) => {
      const enabled = e.target.checked;
      await chrome.storage.sync.set({ enabled });
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        chrome.tabs.sendMessage(tabs[0].id, {
          action: "toggle",
          data: { enabled }
        });
      });
    });
    document.getElementById("filterLevel").addEventListener("change", async (e) => {
      const filterLevel = e.target.value;
      await chrome.storage.sync.set({ filterLevel });
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        chrome.tabs.sendMessage(tabs[0].id, {
          action: "settingsChanged",
          data: { filterLevel }
        });
      });
    });
    document.getElementById("showBadges").addEventListener("change", async (e) => {
      const showBadges = e.target.checked;
      await chrome.storage.sync.set({ showBadges });
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        chrome.tabs.sendMessage(tabs[0].id, {
          action: "settingsChanged",
          data: { showBadges }
        });
      });
    });
    document.getElementById("showAlternatives").addEventListener("change", async (e) => {
      const showAlternatives = e.target.checked;
      await chrome.storage.sync.set({ showAlternatives });
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        chrome.tabs.sendMessage(tabs[0].id, {
          action: "settingsChanged",
          data: { showAlternatives }
        });
      });
    });
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      chrome.tabs.sendMessage(tabs[0].id, { action: "getStats" }, (response) => {
        if (response && response.data) {
          document.getElementById("chainsFiltered").textContent = response.data.chainsFiltered || 0;
          document.getElementById("localHighlighted").textContent = response.data.localHighlighted || 0;
        }
      });
    });
  });
})();
