// popup.js
// Formats and displays prayer times in the popup

'use strict';

/**
 * Convert a 24-hour time string (HH:MM or H:MM, optional seconds) to 12-hour format with AM/PM.
 * If the input already appears to have AM/PM, it will be returned as-is.
 * If the input cannot be parsed, the original string is returned.
 */
function to12Hour(time) {
  if (!time && time !== 0) return '';
  const str = String(time).trim();
  // If already includes AM/PM, return as-is
  if (/[AP]M$/i.test(str)) return str;

  // Match H:MM or HH:MM or with seconds H:MM:SS
  const m = str.match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);
  if (!m) return str;

  let hours = parseInt(m[1], 10);
  const minutes = m[2];
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12;
  if (hours === 0) hours = 12;

  return hours + ':' + minutes + ' ' + ampm;
}

function setText(id, value) {
  const el = document.getElementById(id);
  if (!el) return;
  el.textContent = value ? to12Hour(value) : '—';
}

document.addEventListener('DOMContentLoaded', function () {
  // Expecting prayer times to be stored in chrome.storage (local or sync) under a key like 'prayerTimes'.
  // This code attempts to read common keys and write formatted times to DOM elements with ids:
  // fajr, sunrise, dhuhr, asr, maghrib, isha

  const ids = ['fajr', 'sunrise', 'dhuhr', 'asr', 'maghrib', 'isha'];

  // Try local storage first, fall back to sync
  chrome.storage.local.get('prayerTimes', function (data) {
    let times = data && data.prayerTimes ? data.prayerTimes : null;

    if (!times) {
      // try sync
      chrome.storage.sync.get('prayerTimes', function (d2) {
        times = d2 && d2.prayerTimes ? d2.prayerTimes : {};
        ids.forEach(id => setText(id, times[id] || times[id.toLowerCase()] || ''));
      });
    } else {
      ids.forEach(id => setText(id, times[id] || times[id.toLowerCase()] || ''));
    }
  });
});
