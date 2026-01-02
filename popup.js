// popup.js
// Improved navigation logic for Qaza popup
// - Use cursorDate for display when available
// - Set initial cursor to the oldest unread item (earliest date)
// - Keep a separate scanCursor (do not override while navigating)

// Expected data shape for items (example):
// [{ id, title, cursorDate, date, createdAt, read }, ...]

(async function () {
  // Simple DOM helpers
  const el = id => document.getElementById(id);
  const titleEl = el('title') || el('item-title');
  const dateEl = el('date') || el('item-date');
  const prevBtn = el('prev');
  const nextBtn = el('next');
  const markReadBtn = el('mark-read');
  const statusEl = el('status');

  // State
  let items = [];
  let cursor = 0; // current visible item index
  // scanCursor is maintained separately: used by scanning logic and persisted
  let scanCursor = null;

  // Helpers
  function formatDate(d) {
    if (!d) return '';
    const date = new Date(d);
    if (isNaN(date)) return String(d);
    return date.toLocaleString();
  }

  function displayForIndex(i) {
    if (!items || items.length === 0) return;
    const it = items[i];
    if (!it) return;
    const displayDate = it.cursorDate || it.date || it.createdAt;
    if (titleEl) titleEl.textContent = it.title || ('#' + (i + 1));
    if (dateEl) dateEl.textContent = formatDate(displayDate);
    if (statusEl) statusEl.textContent = it.read ? 'read' : 'unread';
  }

  function clampIndex(i) {
    if (!items || items.length === 0) return 0;
    return Math.max(0, Math.min(items.length - 1, i));
  }

  function findOldestUnreadIndex() {
    if (!items || items.length === 0) return 0;
    let oldestIndex = -1;
    let oldestTime = Infinity;
    items.forEach((it, idx) => {
      if (!it || it.read) return;
      // Prefer cursorDate for determining order when available
      const timeSource = it.cursorDate || it.date || it.createdAt;
      const t = timeSource ? new Date(timeSource).getTime() : NaN;
      if (isNaN(t)) return; // skip un-parseable
      if (t < oldestTime) {
        oldestTime = t;
        oldestIndex = idx;
      }
    });
    // If we didn't find any unread or parseable date, fallback to first unread by index
    if (oldestIndex === -1) {
      const firstUnread = items.findIndex(it => it && !it.read);
      return firstUnread === -1 ? 0 : firstUnread;
    }
    return oldestIndex;
  }

  // Persist scanCursor separately so scanning logic can resume without losing manual navigation
  async function saveScanCursor(value) {
    scanCursor = value;
    if (typeof browser !== 'undefined' && browser.storage && browser.storage.local) {
      await browser.storage.local.set({ scanCursor });
    } else if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      return new Promise(resolve => chrome.storage.local.set({ scanCursor }, resolve));
    }
  }

  async function loadScanCursor() {
    if (typeof browser !== 'undefined' && browser.storage && browser.storage.local) {
      const res = await browser.storage.local.get('scanCursor');
      scanCursor = res ? res.scanCursor : null;
    } else if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      return new Promise(resolve => {
        chrome.storage.local.get('scanCursor', res => {
          scanCursor = res ? res.scanCursor : null;
          resolve();
        });
      });
    }
  }

  // Navigation
  function goToIndex(i) {
    cursor = clampIndex(i);
    displayForIndex(cursor);
    // We intentionally DO NOT overwrite scanCursor here — navigation by user is separate
    // Save last viewed cursor for UX, but keep it separate from scanCursor
    saveLastViewedCursor(cursor);
  }

  function prev() { goToIndex(cursor - 1); }
  function next() { goToIndex(cursor + 1); }

  async function saveLastViewedCursor(idx) {
    if (typeof browser !== 'undefined' && browser.storage && browser.storage.local) {
      await browser.storage.local.set({ lastViewedCursor: idx });
    } else if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      return new Promise(resolve => chrome.storage.local.set({ lastViewedCursor: idx }, resolve));
    }
  }

  async function loadInitialState() {
    // Load items from background or storage
    // This function assumes a sendMessage hook or storage key 'items' exists.
    // We try multiple fallbacks to be robust in different extension environments.
    if (typeof browser !== 'undefined' && browser.runtime && browser.runtime.sendMessage) {
      try {
        const res = await browser.runtime.sendMessage({ type: 'getItems' });
        if (res && Array.isArray(res.items)) {
          items = res.items;
        }
      } catch (e) {
        // ignore
      }
    }

    // Fallback: try storage
    if ((!items || items.length === 0) && typeof browser !== 'undefined' && browser.storage && browser.storage.local) {
      const r = await browser.storage.local.get('items');
      if (r && Array.isArray(r.items)) items = r.items;
    }

    if ((!items || items.length === 0) && typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      await new Promise(resolve => chrome.storage.local.get('items', res => {
        if (res && Array.isArray(res.items)) items = res.items;
        resolve();
      }));
    }

    // Ensure items is at least an empty array
    items = items || [];

    // Load scan cursor if present
    await loadScanCursor();

    // Determine initial cursor: set to the oldest unread item if any
    cursor = findOldestUnreadIndex();

    // If we have a persisted lastViewedCursor but no unread items, prefer lastViewedCursor
    if (items.length > 0) {
      let lastViewed = null;
      if (typeof browser !== 'undefined' && browser.storage && browser.storage.local) {
        const r = await browser.storage.local.get('lastViewedCursor');
        lastViewed = (r && typeof r.lastViewedCursor === 'number') ? r.lastViewedCursor : null;
      } else if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        await new Promise(resolve => chrome.storage.local.get('lastViewedCursor', res => {
          lastViewed = (res && typeof res.lastViewedCursor === 'number') ? res.lastViewedCursor : null;
          resolve();
        }));
      }
      // Only use lastViewed if there are no unread items (we prefer oldest unread)
      const anyUnread = items.some(it => it && it.read === false);
      if (!anyUnread && typeof lastViewed === 'number') {
        cursor = clampIndex(lastViewed);
      }
    }

    // Final UI update
    goToIndex(cursor);
  }

  // Mark current item read
  async function markCurrentRead() {
    const it = items[cursor];
    if (!it) return;
    it.read = true;
    // Persist change back to background or storage
    if (typeof browser !== 'undefined' && browser.runtime && browser.runtime.sendMessage) {
      try {
        await browser.runtime.sendMessage({ type: 'markRead', id: it.id });
      } catch (e) { /* ignore */ }
    }
    if (typeof browser !== 'undefined' && browser.storage && browser.storage.local) {
      await browser.storage.local.set({ items });
    } else if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      await new Promise(resolve => chrome.storage.local.set({ items }, resolve));
    }
    displayForIndex(cursor);
  }

  // Attach UI listeners if present
  if (prevBtn) prevBtn.addEventListener('click', prev);
  if (nextBtn) nextBtn.addEventListener('click', next);
  if (markReadBtn) markReadBtn.addEventListener('click', markCurrentRead);

  // Initialize popup
  await loadInitialState();

  // Expose for debugging
  window.qazaPopup = {
    get items() { return items; },
    get cursor() { return cursor; },
    goToIndex, prev, next, saveScanCursor, loadScanCursor,
  };
})();
