document.addEventListener('DOMContentLoaded', () => {
  ensurePrayerSpans();
  locateAndFetchTimes();
});

// Ensure placeholders/spans exist for each prayer time so UI updates won't fail
function ensurePrayerSpans() {
  const container = document.getElementById('prayer-times');
  if (!container) return; // nothing to do if popup layout doesn't include prayer-times

  const prayers = ['fajr', 'dhuhr', 'asr', 'maghrib', 'isha'];
  prayers.forEach(prayer => {
    let el = document.getElementById(prayer + '-time');
    if (!el) {
      // create a wrapper row if missing (best-effort)
      const row = document.createElement('div');
      row.className = 'prayer-row';
      const label = document.createElement('span');
      label.className = 'prayer-label';
      label.textContent = prayer.charAt(0).toUpperCase() + prayer.slice(1);
      el = document.createElement('span');
      el.id = prayer + '-time';
      el.className = 'prayer-time';
      el.textContent = '—';
      row.appendChild(label);
      row.appendChild(el);
      container.appendChild(row);
    }
  });
}

// Display date with fallback to current local date when Qaza date is missing
function displayDate(qazaDate) {
  const dateEl = document.getElementById('display-date');
  if (!dateEl) return;

  if (qazaDate && typeof qazaDate === 'string' && qazaDate.trim() !== '') {
    dateEl.textContent = qazaDate;
    return;
  }

  // Fallback: use local current date formatted as YYYY-MM-DD
  try {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    dateEl.textContent = `${y}-${m}-${d}`;
  } catch (err) {
    // As a last resort, put a safe placeholder
    dateEl.textContent = 'Date unavailable';
  }
}

// Update UI prayer times; uses placeholders when specific times are missing
function updatePrayerTimes(times = {}) {
  const prayers = ['fajr', 'dhuhr', 'asr', 'maghrib', 'isha'];
  prayers.forEach(prayer => {
    const el = document.getElementById(prayer + '-time');
    if (!el) return; // skip if UI not present

    const value = (times[prayer] && String(times[prayer]).trim()) ? times[prayer] : '—';
    el.textContent = value;
  });
}

// Try to locate the user and fetch prayer times. Errors are handled gracefully with fallbacks.
async function locateAndFetchTimes() {
  try {
    // Try geolocation first
    const position = await getCurrentPosition({ enableHighAccuracy: true, timeout: 5000 }).catch(e => {
      console.warn('Geolocation failed or denied:', e);
      return null;
    });

    let timesData = null;

    if (position) {
      const { latitude, longitude } = position.coords;
      try {
        timesData = await fetchTimesForLatLon(latitude, longitude);
      } catch (err) {
        console.error('Failed to fetch times for coordinates:', err);
      }
    }

    // If we couldn't fetch by geolocation, try stored coordinates or stored times as fallback
    if (!timesData) {
      const stored = localStorage.getItem('qaza_times');
      if (stored) {
        try {
          const parsed = JSON.parse(stored);
          if (parsed && parsed.times) {
            timesData = parsed;
            console.info('Using stored times as fallback');
          }
        } catch (err) {
          console.warn('Could not parse stored times:', err);
        }
      }
    }

    // Final fallback: attempt a generic fetch (may use IP geolocation on server side) before giving up
    if (!timesData) {
      try {
        timesData = await fetchTimesFallback();
      } catch (err) {
        console.warn('Generic fetch fallback failed:', err);
      }
    }

    // If still no times, update UI with placeholders and return
    if (!timesData) {
      displayDate('');
      updatePrayerTimes();
      return;
    }

    // Use the received qaza date if provided, otherwise fallback inside displayDate
    displayDate(timesData.qazaDate || timesData.date || '');

    // Robustly extract times object
    const timesObj = (timesData.times && typeof timesData.times === 'object') ? timesData.times : timesData;
    updatePrayerTimes(timesObj || {});

    // Persist for future fallbacks
    try {
      localStorage.setItem('qaza_times', JSON.stringify({ qazaDate: timesData.qazaDate || timesData.date || null, times: timesObj || {} }));
    } catch (err) {
      console.warn('Could not persist times to localStorage:', err);
    }

  } catch (err) {
    // Catch-all: ensure popup doesn't crash. Show placeholders and log error.
    console.error('Unexpected error in locateAndFetchTimes:', err);
    displayDate('');
    updatePrayerTimes();
  }
}

// Promisified geolocation
function getCurrentPosition(options = {}) {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      return reject(new Error('Geolocation not supported'));
    }
    navigator.geolocation.getCurrentPosition(resolve, reject, options);
  });
}

// Example implementation: replace with your API endpoint/parameters
async function fetchTimesForLatLon(lat, lon) {
  // This function should return an object like: { qazaDate: '...', times: { fajr: '05:00', ... } }
  const url = `https://api.example.com/prayertimes?lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lon)}`;
  const res = await fetch(url, { cache: 'no-cache' });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  // Normalize shape as necessary
  return data;
}

// Generic fallback fetch that may use IP-based geolocation server-side
async function fetchTimesFallback() {
  const url = `https://api.example.com/prayertimes/default`;
  const res = await fetch(url, { cache: 'no-cache' });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  return data;
}
