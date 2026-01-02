// popup.js - Qaza navigation fixes + Aladhan remote times + scan-cursor optimizations

const PRAYERS = ["fajr", "dhuhr", "asr", "maghrib", "isha"];
const QAZA_START_DATE = "1998-08-07";
const QAZA_SCAN_KEY = 'qaza_scan_cursor';

const leftDateDiv = document.getElementById("leftDate");
const rightDateDiv = document.getElementById("rightDate");
const hijriDiv = document.getElementById("hijriDate");
const dailyCountSpan = document.getElementById("dailyCount");
const qazaProgress = document.getElementById("qazaProgress");

const qazaMonth = document.getElementById("qazaMonth");
const qazaYear = document.getElementById("qazaYear");

const saveBtn = document.getElementById("saveBtn");
const loadBtn = document.getElementById("loadBtn");
const fileInput = document.getElementById("fileInput");

const checkboxes = document.querySelectorAll("input[data-prayer]");

/* ---------- Utilities ---------- */

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

function addDaysStr(dateStr, delta) {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + delta);
  return d.toISOString().slice(0, 10);
}

function emptyDay() {
  return { fajr:false, dhuhr:false, asr:false, maghrib:false, isha:false };
}

function completedCount(day) {
  return PRAYERS.filter(p => day[p]).length;
}

function isComplete(day) {
  return completedCount(day) === 5;
}

function hijri(dateStr) {
  const d = new Date(dateStr);
  return new Intl.DateTimeFormat("en-TN-u-ca-islamic", {
    day: "numeric",
    month: "long",
    year: "numeric"
  }).format(d);
}

/* ---------- UI additions (created dynamically) ---------- */
const leftUnlockBtn = document.createElement('button');
leftUnlockBtn.id = 'left-unlock';
leftUnlockBtn.textContent = 'Unlock';
leftUnlockBtn.style.display = 'none';
leftUnlockBtn.style.marginLeft = '8px';
if (leftDateDiv && leftDateDiv.parentNode) leftDateDiv.parentNode.appendChild(leftUnlockBtn);

const rightUnlockBtn = document.createElement('button');
rightUnlockBtn.id = 'right-unlock';
rightUnlockBtn.textContent = 'Unlock';
rightUnlockBtn.style.display = 'none';
rightUnlockBtn.style.marginLeft = '8px';
if (rightDateDiv && rightDateDiv.parentNode) rightDateDiv.parentNode.appendChild(rightUnlockBtn);

const qazaJumpLabel = document.createElement('span');
qazaJumpLabel.id = 'qazaJumpLabel';
qazaJumpLabel.style.marginRight = '8px';
qazaJumpLabel.style.fontWeight = '600';
qazaJumpLabel.textContent = 'Jump to';
if (qazaMonth && qazaMonth.parentNode) qazaMonth.parentNode.insertBefore(qazaJumpLabel, qazaMonth);

/* ---------- Storage ---------- */

function loadState(cb) {
  const raw = localStorage.getItem("prayerState");
  let state = raw ? JSON.parse(raw) : {};
  state.left ||= { cursorDate: todayStr(), data: {} };
  state.right ||= { cursorDate: QAZA_START_DATE, data: {} };
  if (state.right.cursorDate < QAZA_START_DATE)
    state.right.cursorDate = QAZA_START_DATE;
  cb(state);
}

function saveState(state, cb) {
  localStorage.setItem("prayerState", JSON.stringify(state));
  cb && cb();
}

/* ---------- Qaza scan cursor helpers (performance) ---------- */

function readQazaCursor() {
  try { return localStorage.getItem(QAZA_SCAN_KEY) || null; } catch (e) { return null; }
}
function writeQazaCursor(dateStr) {
  try { localStorage.setItem(QAZA_SCAN_KEY, dateStr); } catch (e) {}
}
function clampToTodayOrEarlier(dateStr) {
  const d = new Date(dateStr);
  const today = new Date();
  d.setHours(0,0,0,0);
  today.setHours(0,0,0,0);
  return d > today ? today.toISOString().slice(0,10) : dateStr;
}

/* Find the oldest (earliest) incomplete Qaza date from start -> today */
function findOldestIncompleteDate(rightState) {
  const start = new Date(QAZA_START_DATE);
  const today = new Date();
  for (let d = new Date(start); d <= today; d.setDate(d.getDate() + 1)) {
    const ds = d.toISOString().slice(0, 10);
    const day = rightState.data[ds];
    if (!day || !isComplete(day)) {
      writeQazaCursor(ds);
      return ds;
    }
  }
  const t = today.toISOString().slice(0,10);
  writeQazaCursor(t);
  return rightState.cursorDate || t;
}

/* Find the next incomplete date strictly after fromDate */
function findNextIncompleteAfter(rightState, fromDate) {
  const start = new Date(addDaysStr(fromDate, 1));
  const today = new Date();
  for (let d = new Date(start); d <= today; d.setDate(d.getDate() + 1)) {
    const ds = d.toISOString().slice(0, 10);
    const day = rightState.data[ds];
    if (!day || !isComplete(day)) {
      writeQazaCursor(ds);
      return ds;
    }
  }
  const t = today.toISOString().slice(0,10);
  writeQazaCursor(t);
  return rightState.cursorDate || t;
}

/* ---------- Prayer times via Aladhan (remote API) ---------- */

function formatApiTime(raw) {
  if (!raw) return '';
  const s = String(raw).trim();
  // Try to capture times like "HH:MM", "HH:MM:SS", optionally followed by AM/PM
  const m = s.match(/^(\d{1,2}):(\d{2})(?::\d{2})?\s*(AM|PM|am|pm)?$/);
  if (!m) {
    // Fallback: the API sometimes includes extra text after the time — take the first token
    return s.split(' ')[0];
  }

  let hh = parseInt(m[1], 10);
  const mm = m[2].padStart(2, '0');
  const ampm = m[3];

  if (ampm) {
    // If AM/PM was provided, normalize to a 24-hour number and then format back to 12-hour
    const period = ampm.toUpperCase();
    let hh24 = hh;
    if (period === 'PM' && hh < 12) hh24 = hh + 12;
    if (period === 'AM' && hh === 12) hh24 = 0;
    let disp = hh24 % 12;
    if (disp === 0) disp = 12;
    return `${disp}:${mm} ${period}`;
  }

  // No AM/PM provided — interpret as 24-hour time
  if (hh === 24) hh = 0; // treat 24:00 as midnight
  const period = hh >= 12 ? 'PM' : 'AM';
  hh = hh % 12;
  if (hh === 0) hh = 12;
  return `${hh}:${mm} ${period}`;
}

function setPrayerTimesFromApiTimings(timings) {
  if (!timings) return;
  PRAYERS.forEach(prayer => {
    const key = prayer.charAt(0).toUpperCase() + prayer.slice(1);
    const apiVal = timings[key] || timings[prayer];
    const timeText = formatApiTime(apiVal);

    const inputs = document.querySelectorAll(`input[data-prayer="${prayer}"]`);
    inputs.forEach(input => {
      const label = input.parentNode;
      if (!label) return;
      let span = label.querySelector('.prayer-time');
      if (!span) {
        span = document.createElement('span');
        span.className = 'prayer-time';
        span.setAttribute('aria-hidden', 'true');
        span.style.marginLeft = '8px';
        span.style.opacity = '0.8';
        label.appendChild(span);
      }
      span.textContent = timeText ? `• ${timeText}` : '';
    });
  });
}

function fetchAladhan(lat, lon) {
  const url = `https://api.aladhan.com/v1/timings?latitude=${lat}&longitude=${lon}&method=2`;
  return fetch(url)
    .then(res => res.json())
    .then(json => {
      if (json && json.data && json.data.timings) {
        setPrayerTimesFromApiTimings(json.data.timings);
      } else {
        console.warn('Aladhan response missing timings', json);
      }
    })
    .catch(err => console.warn('Aladhan API fetch failed', err));
}

function fallbackIpLookupAndFetch() {
  return fetch('https://ipapi.co/json/')
    .then(res => res.json())
    .then(data => {
      if (data && data.latitude && data.longitude) {
        return fetchAladhan(data.latitude, data.longitude);
      } else {
        console.warn('IP lookup did not return coordinates', data);
      }
    })
    .catch(err => console.warn('IP lookup failed', err));
}

function locateAndFetchTimes() {
  if (!('geolocation' in navigator)) {
    return fallbackIpLookupAndFetch();
  }
  const options = { timeout: 7000 };
  navigator.geolocation.getCurrentPosition(
    pos => {
      const { latitude, longitude } = pos.coords;
      try { localStorage.setItem('lastCoords', JSON.stringify({ lat: latitude, lon: longitude })); } catch(e) {}
      fetchAladhan(latitude, longitude);
    },
    err => {
      console.warn('Geolocation failed or denied, falling back to IP lookup', err);
      fallbackIpLookupAndFetch();
    },
    options
  );
}

/* ---------- Rendering ---------- */

function render(state) {
  renderSide(state, "left");
  renderSide(state, "right");
}

function renderSide(state, side) {
  const s = state[side];
  const date = s.cursorDate;
  s.data[date] ||= emptyDay();
  const day = s.data[date];

  if (side === "left") {
    leftDateDiv.textContent = date;
    dailyCountSpan.textContent = completedCount(day);
  } else {
    // Display the active cursorDate (so navigation updates UI immediately)
    const displayDate = s.cursorDate;
    rightDateDiv.textContent = displayDate;
    hijriDiv.textContent = hijri(displayDate);

    const completedDays = Object.values(state.right.data).filter(isComplete).length;
    qazaProgress.textContent = `Completed Qaza Days: ${completedDays}`;

    if (qazaJumpLabel) qazaJumpLabel.textContent = 'Jump to';

    let rd = document.getElementById('readingFor');
    if (!rd) {
      rd = document.createElement('div');
      rd.id = 'readingFor';
      rd.style.marginTop = '6px';
      rd.style.fontSize = '13px';
      rd.style.opacity = '0.9';
      if (rightDateDiv && hijriDiv && rightDateDiv.parentNode) {
        rightDateDiv.parentNode.insertBefore(rd, hijriDiv);
      } else if (rightDateDiv && rightDateDiv.parentNode) {
        rightDateDiv.parentNode.appendChild(rd);
      } else {
        document.body.appendChild(rd);
      }
    }
    rd.textContent = `Reading for ${displayDate}`;
  }

  checkboxes.forEach(cb => {
    if (cb.dataset.side === side) {
      cb.checked = !!day[cb.dataset.prayer];

      const unlocked = !!s.data[date].unlocked;
      cb.disabled = (side === "right" && isComplete(day) && !unlocked);

      cb.closest("label").classList.toggle(
        "completed",
        side === "right" && isComplete(day) && !unlocked
      );
    }
  });

  if (side === 'right') {
    if (isComplete(day) && !s.data[date].unlocked) {
      rightUnlockBtn.style.display = 'inline-block';
    } else {
      rightUnlockBtn.style.display = 'none';
    }
  } else {
    leftUnlockBtn.style.display = 'none';
  }
}

/* ---------- Qaza jump ---------- */

function setupJump() {
  for (let m = 0; m < 12; m++) {
    const opt = document.createElement("option");
    opt.value = m;
    opt.textContent = new Date(2000, m).toLocaleString("default", { month: "short" });
    qazaMonth.appendChild(opt);
  }

  const yearNow = new Date().getFullYear();
  for (let y = 1998; y <= yearNow; y++) {
    const opt = document.createElement("option");
    opt.value = y;
    opt.textContent = y;
    qazaYear.appendChild(opt);
  }
}

function jumpQaza(state) {
  const d = new Date(qazaYear.value, qazaMonth.value, 1);
  const iso = d.toISOString().slice(0,10);
  state.right.cursorDate = iso < QAZA_START_DATE ? QAZA_START_DATE : iso;
}

/* ---------- Events ---------- */

checkboxes.forEach(cb => {
  cb.onchange = () => {
    loadState(state => {
      const side = cb.dataset.side;
      const date = state[side].cursorDate;
      state[side].data[date] ||= emptyDay();
      state[side].data[date][cb.dataset.prayer] = cb.checked;

      if (side === "right" && isComplete(state.right.data[date])) {
        if (!state.right.data[date].unlocked) {
          // advance to the next incomplete date (scan forward)
          state.right.cursorDate = findNextIncompleteAfter(state.right, date);
        }
      }

      saveState(state, () => render(state));
    });
  };
});

qazaMonth.onchange = qazaYear.onchange = () => {
  loadState(state => {
    jumpQaza(state);
    saveState(state, () => render(state));
  });
};

if (leftUnlockBtn) leftUnlockBtn.onclick = () => {
  loadState(state => {
    const side = 'left';
    const date = state[side].cursorDate;
    state[side].data[date] ||= emptyDay();
    state[side].data[date].unlocked = true;
    saveState(state, () => render(state));
  });
};

if (rightUnlockBtn) rightUnlockBtn.onclick = () => {
  loadState(state => {
    const side = 'right';
    const date = state[side].cursorDate;
    state[side].data[date] ||= emptyDay();
    state[side].data[date].unlocked = true;
    saveState(state, () => render(state));
  });
};


document.getElementById("leftPrev").onclick = () => move("left",-1);
document.getElementById("leftNext").onclick = () => move("left",1);
document.getElementById("rightPrev").onclick = () => move("right",-1);
document.getElementById("rightNext").onclick = () => move("right",1);

function move(side, d) {
  loadState(state => {
    state[side].cursorDate = addDaysStr(state[side].cursorDate, d);
    if (side === "right" && state.right.cursorDate < QAZA_START_DATE)
      state.right.cursorDate = QAZA_START_DATE;
    saveState(state, () => render(state));
  });
}

/* ---------- File Save / Load ---------- */

saveBtn.onclick = () => {
  loadState(state => {
    const blob = new Blob([JSON.stringify(state,null,2)],{type:"application/json"});
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "prayer-data.json";
    a.click();
  });
};

loadBtn.onclick = () => fileInput.click();

fileInput.onchange = () => {
  const r = new FileReader();
  r.onload = e => {
    const parsed = JSON.parse(e.target.result);
    saveState(parsed, () => render(parsed));
  };
  r.readAsText(fileInput.files[0]);
};

/* ---------- Init ---------- */

setupJump();
// Show a user-friendly today label on the left immediately
if (leftDateDiv) {
  const todayDisplay = new Date().toLocaleDateString(undefined, { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' });
  leftDateDiv.textContent = todayDisplay;
}

// Initialize state and set cursorDate to the oldest unread date
loadState(state => {
  // If there is any incomplete date, start there
  state.right.cursorDate = findOldestIncompleteDate(state.right);
  saveState(state, () => {
    render(state);
    try { locateAndFetchTimes(); } catch(e) { console.warn('prayer times init failed', e); }
  });
});
