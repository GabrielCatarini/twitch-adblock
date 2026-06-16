(() => {
  const api = globalThis.browser ?? globalThis.chrome;

  const enabledToggle = document.getElementById("enabledToggle");
  const watchdogToggle = document.getElementById("watchdogToggle");
  const stateText = document.getElementById("stateText");
  const engineVersion = document.getElementById("engineVersion");
  const conflictText = document.getElementById("conflictText");
  const watchdogText = document.getElementById("watchdogText");
  const reloadBtn = document.getElementById("reloadBtn");
  const adsBlockedCount = document.getElementById("adsBlockedCount");

  const storageGet = (defaults) =>
    new Promise((resolve, reject) => {
      try {
        const maybePromise = api.storage.local.get(defaults, (result) => {
          if (api.runtime?.lastError) {
            reject(new Error(api.runtime.lastError.message));
            return;
          }
          resolve(result);
        });
        if (maybePromise && typeof maybePromise.then === "function") {
          maybePromise.then(resolve).catch(reject);
        }
      } catch (error) {
        reject(error);
      }
    });

  const storageSet = (values) =>
    new Promise((resolve, reject) => {
      try {
        const maybePromise = api.storage.local.set(values, () => {
          if (api.runtime?.lastError) {
            reject(new Error(api.runtime.lastError.message));
            return;
          }
          resolve();
        });
        if (maybePromise && typeof maybePromise.then === "function") {
          maybePromise.then(resolve).catch(reject);
        }
      } catch (error) {
        reject(error);
      }
    });

  const queryTabs = (queryInfo) =>
    new Promise((resolve, reject) => {
      try {
        const maybePromise = api.tabs.query(queryInfo, (tabs) => {
          if (api.runtime?.lastError) {
            reject(new Error(api.runtime.lastError.message));
            return;
          }
          resolve(tabs || []);
        });
        if (maybePromise && typeof maybePromise.then === "function") {
          maybePromise.then(resolve).catch(reject);
        }
      } catch (error) {
        reject(error);
      }
    });

  const reloadTab = (tabId) =>
    new Promise((resolve, reject) => {
      try {
        const maybePromise = api.tabs.reload(tabId, {}, () => {
          if (api.runtime?.lastError) {
            reject(new Error(api.runtime.lastError.message));
            return;
          }
          resolve();
        });
        if (maybePromise && typeof maybePromise.then === "function") {
          maybePromise.then(resolve).catch(reject);
        }
      } catch (error) {
        reject(error);
      }
    });

  const createTab = (createProperties) =>
    new Promise((resolve, reject) => {
      try {
        const maybePromise = api.tabs.create(createProperties, (tab) => {
          if (api.runtime?.lastError) {
            reject(new Error(api.runtime.lastError.message));
            return;
          }
          resolve(tab);
        });
        if (maybePromise && typeof maybePromise.then === "function") {
          maybePromise.then(resolve).catch(reject);
        }
      } catch (error) {
        reject(error);
      }
    });

  const updateStateText = (enabled) => {
    stateText.textContent = enabled
      ? "Active — reload stream if already playing"
      : "Disabled";
    stateText.classList.toggle("on", enabled);
    stateText.classList.toggle("off", !enabled);
  };

  const formatCheckedAt = (checkedAt) => {
    if (!checkedAt) {
      return "unknown";
    }
    try {
      return new Date(checkedAt).toLocaleTimeString();
    } catch {
      return "unknown";
    }
  };

  const updateConflictText = (conflictInfo) => {
    conflictText.classList.remove("warn", "ok");

    if (!conflictInfo || !conflictInfo.checkedAt) {
      conflictText.textContent = "Open or reload a Twitch tab to run conflict detection.";
      return;
    }

    const markerNames = Array.isArray(conflictInfo.markers)
      ? conflictInfo.markers.map((marker) => marker.name).filter(Boolean)
      : [];

    if (conflictInfo.hasConflict) {
      const details = markerNames.length ? ` (${markerNames.join(", ")})` : "";
      conflictText.textContent = `Conflict detected${details} — disable other Twitch blockers and reload.`;
      conflictText.classList.add("warn");
      return;
    }

    conflictText.textContent = `No conflicts detected (checked ${formatCheckedAt(conflictInfo.checkedAt)})`;
    conflictText.classList.add("ok");
  };

  const updateWatchdogText = (watchdogEnabled, watchdogInfo) => {
    watchdogText.classList.remove("warn", "ok");

    if (!watchdogEnabled) {
      watchdogText.textContent = "Disabled";
      watchdogText.classList.add("off");
      return;
    }
    watchdogText.classList.remove("off");

    if (!watchdogInfo || !watchdogInfo.status) {
      watchdogText.textContent = "Waiting for Twitch tab...";
      return;
    }

    const statusMap = {
      starting: "Starting",
      warming_up: "Warming up",
      waiting_for_video: "Waiting for stream",
      monitoring: "Monitoring",
      idle: "Idle",
      recovering: "Recovering playback",
      reloading_tab: "Reloading tab",
      disabled_by_extension: "Off (ad blocking disabled)",
      disabled_by_user: "Disabled"
    };
    const status = statusMap[watchdogInfo.status] || watchdogInfo.status;

    if (watchdogInfo.lastRecoveryAt && watchdogInfo.lastRecoveryAction) {
      const when = formatCheckedAt(watchdogInfo.lastRecoveryAt);
      const action = watchdogInfo.lastRecoveryAction.replace("_", "/");
      watchdogText.textContent = `${status} — last recovery ${when} (${action})`;
      watchdogText.classList.add("warn");
      return;
    }

    watchdogText.textContent = status;
    watchdogText.classList.add("ok");
  };

  const updateAdsBlocked = (count) => {
    const n = Number(count) || 0;
    const prev = adsBlockedCount.textContent;
    adsBlockedCount.textContent = n.toLocaleString();
    if (prev !== "0" && prev !== adsBlockedCount.textContent) {
      adsBlockedCount.classList.add("bump");
      setTimeout(() => adsBlockedCount.classList.remove("bump"), 200);
    }
  };

  const loadEngineVersion = async () => {
    try {
      const response = await fetch(api.runtime.getURL("injected/upstream.txt"));
      if (!response.ok) {
        throw new Error("metadata request failed");
      }
      const content = await response.text();
      const versionLine = content
        .split("\n")
        .find((line) => line.startsWith("version="));
      const version = versionLine ? versionLine.split("=")[1] : "unknown";
      engineVersion.textContent = `Engine: v${version}`;
    } catch {
      engineVersion.textContent = "Engine: unknown";
    }
  };

  const handleReloadClick = async () => {
    try {
      const activeTabs = await queryTabs({ active: true, currentWindow: true });
      const activeTab = activeTabs[0];
      if (activeTab?.id && activeTab.url?.includes("twitch.tv")) {
        await reloadTab(activeTab.id);
        window.close();
        return;
      }

      const twitchTabs = await queryTabs({ url: ["*://*.twitch.tv/*"] });
      const targetTab = twitchTabs[0];
      if (targetTab?.id) {
        await reloadTab(targetTab.id);
        window.close();
        return;
      }

      await createTab({ url: "https://www.twitch.tv" });
      window.close();
    } catch {
      // Keep popup usable even when browser API calls fail.
    }
  };

  const init = async () => {
    const current = await storageGet({
      enabled: true,
      watchdogEnabled: true,
      conflictInfo: null,
      watchdogInfo: null,
      adsBlocked: 0
    });
    const enabled = current.enabled !== false;
    const watchdogEnabled = current.watchdogEnabled !== false;
    enabledToggle.checked = enabled;
    watchdogToggle.checked = watchdogEnabled;
    updateStateText(enabled);
    updateAdsBlocked(current.adsBlocked);
    updateConflictText(current.conflictInfo);
    updateWatchdogText(watchdogEnabled, current.watchdogInfo);
    await loadEngineVersion();
  };

  enabledToggle.addEventListener("change", async () => {
    const enabled = enabledToggle.checked;
    updateStateText(enabled);
    try {
      await storageSet({ enabled });
    } catch {
      updateStateText(true);
      enabledToggle.checked = true;
    }
  });

  watchdogToggle.addEventListener("change", async () => {
    const watchdogEnabled = watchdogToggle.checked;
    updateWatchdogText(watchdogEnabled, null);
    try {
      await storageSet({ watchdogEnabled });
    } catch {
      watchdogToggle.checked = true;
      updateWatchdogText(true, null);
    }
  });

  reloadBtn.addEventListener("click", handleReloadClick);

  if (api.storage?.onChanged?.addListener) {
    api.storage.onChanged.addListener((changes, areaName) => {
      if (areaName !== "local") {
        return;
      }
      if (changes.enabled) {
        const enabled = changes.enabled.newValue !== false;
        enabledToggle.checked = enabled;
        updateStateText(enabled);
      }
      if (changes.watchdogEnabled) {
        const wd = changes.watchdogEnabled.newValue !== false;
        watchdogToggle.checked = wd;
        updateWatchdogText(wd, changes.watchdogInfo?.newValue ?? null);
      }
      if (changes.watchdogInfo) {
        updateWatchdogText(watchdogToggle.checked, changes.watchdogInfo.newValue);
      }
      if (changes.conflictInfo) {
        updateConflictText(changes.conflictInfo.newValue);
      }
      if (changes.adsBlocked) {
        updateAdsBlocked(changes.adsBlocked.newValue);
      }
    });
  }

  init().catch(() => {
    enabledToggle.checked = true;
    updateStateText(true);
    engineVersion.textContent = "Engine: unknown";
    updateAdsBlocked(0);
    updateConflictText(null);
    watchdogToggle.checked = true;
    updateWatchdogText(true, null);
  });
})();
