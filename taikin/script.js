const STORAGE_KEY = "taikin-button:last-clock-out";

const elements = {
  button: document.querySelector("#clockOutButton"),
  buttonLabel: document.querySelector("#buttonLabel"),
  buttonSubcopy: document.querySelector("#buttonSubcopy"),
  buttonNote: document.querySelector("#buttonNote"),
  cardDay: document.querySelector("#cardDay"),
  cardMonth: document.querySelector("#cardMonth"),
  currentTime: document.querySelector("#currentTime"),
  flash: document.querySelector("#flash"),
  recorder: document.querySelector("#timeRecorder"),
  resultPanel: document.querySelector("#resultPanel"),
  resultTime: document.querySelector("#resultTime"),
  shareButton: document.querySelector("#shareButton"),
  stampTime: document.querySelector("#stampTime"),
  todayLabel: document.querySelector("#todayLabel"),
};

const pad = (number) => String(number).padStart(2, "0");

function dateKey(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function formatTime(date, includeSeconds = false) {
  const time = `${pad(date.getHours())}:${pad(date.getMinutes())}`;
  return includeSeconds ? `${time}:${pad(date.getSeconds())}` : time;
}

function getSavedClockOut() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw);
    if (!parsed?.date || !parsed?.timestamp) return null;
    return parsed;
  } catch {
    return null;
  }
}

function updateCalendar(now) {
  elements.todayLabel.textContent = `${now.getFullYear()}.${pad(now.getMonth() + 1)}.${pad(now.getDate())}`;
  elements.cardMonth.textContent = `${now.getMonth() + 1} 月`;
  elements.cardDay.textContent = pad(now.getDate());
}

function updateClock() {
  elements.currentTime.textContent = formatTime(new Date(), true);
}

function showClockedOutState(timestamp, animate = false) {
  const clockedOutAt = new Date(timestamp);
  const displayTime = formatTime(clockedOutAt);

  elements.stampTime.textContent = displayTime;
  elements.resultTime.textContent = displayTime;
  elements.button.disabled = true;
  elements.buttonSubcopy.textContent = "本日はすでに";
  elements.buttonLabel.textContent = "退勤済み";
  elements.buttonNote.textContent = "また明日、押してください";
  elements.resultPanel.hidden = false;
  elements.recorder.classList.add("is-stamped");

  if (animate) {
    elements.button.classList.add("is-pressing");
    elements.recorder.classList.add("is-stamping");
    elements.flash.classList.add("is-active");

    window.setTimeout(() => elements.button.classList.remove("is-pressing"), 180);
    window.setTimeout(() => elements.recorder.classList.remove("is-stamping"), 480);
    window.setTimeout(() => elements.flash.classList.remove("is-active"), 260);
    window.setTimeout(() => {
      elements.resultPanel.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 700);
  }
}

function playClockOutSound() {
  const AudioContext = window.AudioContext || window.webkitAudioContext;
  if (!AudioContext) return;

  const context = new AudioContext();
  const now = context.currentTime;

  const click = context.createOscillator();
  const clickGain = context.createGain();
  click.type = "square";
  click.frequency.setValueAtTime(105, now);
  click.frequency.exponentialRampToValueAtTime(48, now + 0.08);
  clickGain.gain.setValueAtTime(0.13, now);
  clickGain.gain.exponentialRampToValueAtTime(0.001, now + 0.09);
  click.connect(clickGain).connect(context.destination);
  click.start(now);
  click.stop(now + 0.09);

  const bell = context.createOscillator();
  const bellGain = context.createGain();
  bell.type = "sine";
  bell.frequency.setValueAtTime(880, now + 0.1);
  bellGain.gain.setValueAtTime(0.0001, now);
  bellGain.gain.setValueAtTime(0.08, now + 0.1);
  bellGain.gain.exponentialRampToValueAtTime(0.001, now + 0.42);
  bell.connect(bellGain).connect(context.destination);
  bell.start(now + 0.1);
  bell.stop(now + 0.43);
}

function clockOut() {
  const now = new Date();
  const saved = getSavedClockOut();

  if (saved?.date === dateKey(now)) {
    showClockedOutState(saved.timestamp);
    return;
  }

  const record = {
    date: dateKey(now),
    timestamp: now.toISOString(),
  };

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(record));
  } catch {
    // Storage may be unavailable in a privacy-restricted browser.
  }

  playClockOutSound();
  showClockedOutState(record.timestamp, true);
}

function shareOnX() {
  const saved = getSavedClockOut();
  const clockedOutAt = saved?.timestamp ? new Date(saved.timestamp) : new Date();
  const time = formatTime(clockedOutAt);
  const text = `${time}、本日の業務を終了しました。\n今日も一日おつかれさまでした。\n\n#退勤ボタン`;
  const isWebPage = window.location.protocol.startsWith("http");
  const params = new URLSearchParams({ text });

  if (isWebPage) params.set("url", window.location.href);

  window.open(
    `https://twitter.com/intent/tweet?${params.toString()}`,
    "x-share",
    "width=640,height=520,noopener,noreferrer"
  );
}

function initialise() {
  const now = new Date();
  const saved = getSavedClockOut();

  updateCalendar(now);
  updateClock();
  window.setInterval(updateClock, 1000);

  if (saved?.date === dateKey(now)) {
    showClockedOutState(saved.timestamp);
  }

  elements.button.addEventListener("click", clockOut);
  elements.shareButton.addEventListener("click", shareOnX);
}

initialise();
