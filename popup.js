const PRAYERS = ["fajr", "dhuhr", "asr", "maghrib", "isha"];
const QAZA_START_DATE = "1998-08-07";

/* ---------- Elements ---------- */

const leftDateDiv = document.getElementById("leftDate");
const rightDateDiv = document.getElementById("rightDate");
const dailyCountSpan = document.getElementById("dailyCount");

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

/* ---------- Storage ---------- */

function loadState(cb) {
  const raw = localStorage.getItem("prayerState");
  let state = raw ? JSON.parse(raw) : {};
  state.left ||= { cursorDate: todayStr(), data: {} };
  state.right ||= { cursorDate: QAZA_START_DATE, data: {} };

  if (state.right.cursorDate < QAZA_START_DATE) {
    state.right.cursorDate = QAZA_START_DATE;
  }

  cb(state);
}

function saveState(state, cb) {
  localStorage.setItem("prayerState", JSON.stringify(state));
  cb && cb();
}

/* ---------- Rendering ---------- */

function renderSide(state, side) {
  const sideState = state[side];
  const date = sideState.cursorDate;

  sideState.data[date] ||= emptyDay();
  const day = sideState.data[date];

  if (side === "left") {
    leftDateDiv.textContent = date;
    dailyCountSpan.textContent = completedCount(day);
  } else {
    rightDateDiv.textContent = date;
  }

  checkboxes.forEach(cb => {
    if (cb.dataset.side === side) {
      cb.checked = !!day[cb.dataset.prayer];
    }
  });
}

function render(state) {
  renderSide(state, "left");
  renderSide(state, "right");
}

/* ---------- Qaza helpers ---------- */

function findNextIncomplete(state, startDate) {
  let d = startDate;
  while (true) {
    state.right.data[d] ||= emptyDay();
    if (!isComplete(state.right.data[d])) return d;
    d = addDaysStr(d, 1);
  }
}

function findEarliest(state) {
  const dates = Object.keys(state.right.data).sort();
  return dates.length ? dates[0] : QAZA_START_DATE;
}

/* ---------- Checkbox handling ---------- */

checkboxes.forEach(cb => {
  cb.addEventListener("change", () => {
    loadState(state => {
      const side = cb.dataset.side;
      const prayer = cb.dataset.prayer;
      const date = state[side].cursorDate;

      state[side].data[date] ||= emptyDay();
      state[side].data[date][prayer] = cb.checked;

      if (side === "right" && isComplete(state.right.data[date])) {
        state.right.cursorDate = findNextIncomplete(
          state,
          addDaysStr(date, 1)
        );
      }

      saveState(state, () => render(state));
    });
  });
});

/* ---------- Navigation ---------- */

function move(side, delta) {
  loadState(state => {
    let next = addDaysStr(state[side].cursorDate, delta);
    if (side === "right" && next < QAZA_START_DATE) {
      next = QAZA_START_DATE;
    }
    state[side].cursorDate = next;
    saveState(state, () => render(state));
  });
}

document.getElementById("leftPrev").onclick  = () => move("left", -1);
document.getElementById("leftNext").onclick  = () => move("left",  1);

document.getElementById("rightPrev").onclick = () => move("right", -1);
document.getElementById("rightNext").onclick = () => move("right",  1);
document.getElementById("rightEarliest").onclick = () => {
  loadState(state => {
    state.right.cursorDate = findEarliest(state);
    saveState(state, () => render(state));
  });
};

/* ---------- Save / Load File ---------- */

saveBtn.onclick = () => {
  loadState(state => {
    const blob = new Blob(
      [JSON.stringify(state, null, 2)],
      { type: "application/json" }
    );
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "prayer-data.json";
    a.click();
    URL.revokeObjectURL(a.href);
  });
};

loadBtn.onclick = () => {
  fileInput.value = "";
  fileInput.click();
};

fileInput.onchange = () => {
  const file = fileInput.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = e => {
    try {
      const parsed = JSON.parse(e.target.result);
      if (!parsed.left || !parsed.right) {
        alert("Invalid file format");
        return;
      }

      parsed.right.cursorDate = QAZA_START_DATE;
      saveState(parsed, () => render(parsed));

    } catch {
      alert("Invalid JSON file");
    }
  };
  reader.readAsText(file);
};

/* ---------- Load ---------- */

loadState(state => {
  state.right.cursorDate = QAZA_START_DATE;
  saveState(state, () => render(state));
});
