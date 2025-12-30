const PRAYERS = ["fajr", "dhuhr", "asr", "maghrib", "isha"];
const QAZA_START_DATE = "1998-08-07";

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
    rightDateDiv.textContent = date;
    hijriDiv.textContent = hijri(date);

    const completedDays =
      Object.values(state.right.data).filter(isComplete).length;
    qazaProgress.textContent =
      `Completed Qaza Days: ${completedDays}`;
  }

  checkboxes.forEach(cb => {
    if (cb.dataset.side === side) {
      cb.checked = !!day[cb.dataset.prayer];
      cb.disabled = (side === "right" && isComplete(day));
      cb.closest("label").classList.toggle(
        "completed",
        side === "right" && isComplete(day)
      );
    }
  });
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
        state.right.cursorDate = addDaysStr(date, 1);
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
loadState(state => {
  state.right.cursorDate = QAZA_START_DATE;
  saveState(state, () => render(state));
});
