const STORAGE_KEY = "taikin-button:last-clock-out";

const CLOCK_OUT_MESSAGES = [
  "今日のあなたは、もう自由です。",
  "本日のタスク、ここで閉店です。",
  "PCより先に、心をスリープさせましょう。",
  "今日の分は、ちゃんとやりました。",
  "続きは明日の自分に任せます。",
  "ここから先は、あなたの時間です。",
  "おつかれさま。寄り道して帰ろう。",
  "今日はここまでで十分です。",
  "退勤の音、よく響きました。",
  "今日も無事に店じまい。",
  "仕事のことは会社に置いて帰りましょう。",
  "がんばった記録、打刻しました。",
  "そろそろ肩の力を抜く時間です。",
  "本日のあなたに、花丸です。",
  "今日の残りは好きに使ってください。",
  "もう通知は見なくて大丈夫。",
  "退勤しました。深呼吸をひとつ。",
  "明日のことは、明日考えましょう。",
  "今日も一日、よく持ちこたえました。",
  "帰る準備はできています。",
];

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
  resultMessage: document.querySelector("#resultMessage"),
  resultTime: document.querySelector("#resultTime"),
  shareButton: document.querySelector("#shareButton"),
  shareImageButton: document.querySelector("#shareImageButton"),
  shareStatus: document.querySelector("#shareStatus"),
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

function showClockedOutState(timestamp, animate = false, message = CLOCK_OUT_MESSAGES[0]) {
  const clockedOutAt = new Date(timestamp);
  const displayTime = formatTime(clockedOutAt);

  elements.stampTime.textContent = displayTime;
  elements.resultTime.textContent = displayTime;
  elements.resultMessage.textContent = message;
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
    showClockedOutState(saved.timestamp, false, saved.message);
    return;
  }

  const message = CLOCK_OUT_MESSAGES[Math.floor(Math.random() * CLOCK_OUT_MESSAGES.length)];
  const record = {
    date: dateKey(now),
    timestamp: now.toISOString(),
    message,
  };

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(record));
  } catch {
    // Storage may be unavailable in a privacy-restricted browser.
  }

  playClockOutSound();
  showClockedOutState(record.timestamp, true, record.message);
}

function drawRoundedRect(context, x, y, width, height, radius) {
  const safeRadius = Math.min(radius, width / 2, height / 2);
  context.beginPath();
  context.moveTo(x + safeRadius, y);
  context.arcTo(x + width, y, x + width, y + height, safeRadius);
  context.arcTo(x + width, y + height, x, y + height, safeRadius);
  context.arcTo(x, y + height, x, y, safeRadius);
  context.arcTo(x, y, x + width, y, safeRadius);
  context.closePath();
}

function drawCanvasPaw(context, centerX, centerY, scale = 1) {
  context.beginPath();
  context.ellipse(centerX, centerY + 10 * scale, 19 * scale, 15 * scale, 0, 0, Math.PI * 2);
  context.fill();

  [
    { x: -22, y: -10, radiusX: 8, radiusY: 10, rotation: -0.35 },
    { x: -8, y: -18, radiusX: 8, radiusY: 11, rotation: -0.12 },
    { x: 8, y: -18, radiusX: 8, radiusY: 11, rotation: 0.12 },
    { x: 22, y: -10, radiusX: 8, radiusY: 10, rotation: 0.35 },
  ].forEach((toe) => {
    context.beginPath();
    context.ellipse(
      centerX + toe.x * scale,
      centerY + toe.y * scale,
      toe.radiusX * scale,
      toe.radiusY * scale,
      toe.rotation,
      0,
      Math.PI * 2
    );
    context.fill();
  });
}

function dataUrlToFile(dataUrl, filename) {
  const [metadata, encoded] = dataUrl.split(",");
  const mimeType = metadata.match(/data:(.*?);base64/)?.[1] || "image/png";
  const bytes = Uint8Array.from(window.atob(encoded), (character) => character.charCodeAt(0));
  return new File([bytes], filename, { type: mimeType });
}

function createTimeCardFile(clockedOutAt, message) {
  if (typeof File === "undefined") return null;

  const canvas = document.createElement("canvas");
  canvas.width = 1200;
  canvas.height = 630;
  const context = canvas.getContext("2d");
  if (!context) return null;

  context.fillStyle = "#d7cdbb";
  context.fillRect(0, 0, canvas.width, canvas.height);

  context.fillStyle = "rgba(255, 248, 232, 0.22)";
  for (let row = 0; row < 8; row += 1) {
    for (let column = 0; column < 15; column += 1) {
      if ((row + column) % 2 === 0) context.fillRect(column * 80, row * 80, 80, 80);
    }
  }

  context.save();
  context.shadowColor = "rgba(81, 72, 63, 0.16)";
  context.shadowBlur = 30;
  context.shadowOffsetY = 16;
  drawRoundedRect(context, 145, 70, 910, 490, 46);
  context.fillStyle = "#fff8e8";
  context.fill();
  context.restore();

  context.fillStyle = "#51483f";
  context.font = '700 25px "Hiragino Sans", "Yu Gothic", sans-serif';
  context.letterSpacing = "4px";
  context.fillText("ASOBI WORKS / TIME CARD", 205, 135);

  context.fillStyle = "#8b7d70";
  context.font = '600 24px "Hiragino Sans", "Yu Gothic", sans-serif';
  const dateLabel = `${clockedOutAt.getFullYear()}.${pad(clockedOutAt.getMonth() + 1)}.${pad(clockedOutAt.getDate())}`;
  context.fillText(dateLabel, 205, 194);

  context.fillStyle = "#51483f";
  context.font = '800 112px "Hiragino Sans", "Yu Gothic", sans-serif';
  context.fillText(formatTime(clockedOutAt), 195, 325);

  context.save();
  context.translate(862, 265);
  context.rotate(-7 * Math.PI / 180);
  context.globalAlpha = 0.88;
  context.strokeStyle = "#ce8d78";
  context.fillStyle = "#ce8d78";
  context.lineWidth = 8;
  context.beginPath();
  context.arc(0, 0, 80, 0, Math.PI * 2);
  context.stroke();
  drawCanvasPaw(context, 0, -28, 0.85);
  context.textAlign = "center";
  context.font = '800 29px "Hiragino Sans", "Yu Gothic", sans-serif';
  context.fillText("退勤済", 0, 54);
  context.restore();

  context.textAlign = "left";
  context.fillStyle = "#51483f";
  context.font = '700 31px "Hiragino Sans", "Yu Gothic", sans-serif';
  context.fillText(message, 205, 427, 790);
  context.fillStyle = "#8b7d70";
  context.font = '600 22px "Hiragino Sans", "Yu Gothic", sans-serif';
  context.fillText("今日も一日、おつかれさまでした。", 205, 492);

  return dataUrlToFile(canvas.toDataURL("image/png"), "taikin-time-card.png");
}

function openXShare(text) {
  const params = new URLSearchParams({
    text,
    url: "https://asobi-seven.vercel.app/",
  });
  window.location.assign(`https://twitter.com/intent/tweet?${params.toString()}`);
}

function isMobileShareEnvironment() {
  return /Android|iPhone|iPad|iPod/i.test(navigator.userAgent)
    || (/Macintosh/i.test(navigator.userAgent) && navigator.maxTouchPoints > 1);
}

async function copyTimeCardToClipboard(timeCard) {
  if (!timeCard || !navigator.clipboard?.write || typeof ClipboardItem === "undefined") {
    return false;
  }

  try {
    const clipboardItem = new ClipboardItem({ "image/png": timeCard });
    await navigator.clipboard.write([clipboardItem]);
    return true;
  } catch {
    return false;
  }
}

function showShareStatus(message) {
  elements.shareStatus.textContent = message;
  elements.shareStatus.hidden = false;
}

function shareOnX() {
  const saved = getSavedClockOut();
  const clockedOutAt = saved?.timestamp ? new Date(saved.timestamp) : new Date();
  const time = formatTime(clockedOutAt);

  let text = `${time}、本日の業務を終了しました。\n今日も一日おつかれさまでした。`;
  text += `\n\n#退勤ボタン`;
  openXShare(text);
}

function downloadTimeCard(timeCard) {
  const downloadUrl = URL.createObjectURL(timeCard);
  const link = document.createElement("a");
  link.href = downloadUrl;
  link.download = timeCard.name;
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(downloadUrl), 1000);
}

async function shareTimeCardImage() {
  const saved = getSavedClockOut();
  const clockedOutAt = saved?.timestamp ? new Date(saved.timestamp) : new Date();
  const time = formatTime(clockedOutAt);
  const message = saved?.message || elements.resultMessage.textContent || CLOCK_OUT_MESSAGES[0];
  const timeCard = createTimeCardFile(clockedOutAt, message);

  if (!timeCard) {
    showShareStatus("タイムカード画像を作成できませんでした。");
    return;
  }

  const shareData = {
    title: "退勤ボタン",
    text: `${time}、本日の業務を終了しました。\n今日も一日おつかれさまでした。\n\n#退勤ボタン\nhttps://asobi-seven.vercel.app/`,
    files: [timeCard],
  };

  if (navigator.share && navigator.canShare?.({ files: [timeCard] })) {
    showShareStatus("共有先でXを選んでください。");
    try {
      await navigator.share(shareData);
      elements.shareStatus.hidden = true;
      return;
    } catch (error) {
      if (error?.name === "AbortError") {
        elements.shareStatus.hidden = true;
        return;
      }
    }
  }

  downloadTimeCard(timeCard);
  showShareStatus("画像を保存しました。Xの投稿に添付してください。");
}

function initialise() {
  const now = new Date();
  const saved = getSavedClockOut();

  updateCalendar(now);
  updateClock();
  window.setInterval(updateClock, 1000);

  if (saved?.date === dateKey(now)) {
    showClockedOutState(saved.timestamp, false, saved.message);
  }

  elements.button.addEventListener("click", clockOut);
  elements.shareButton.addEventListener("click", shareOnX);
  elements.shareImageButton.addEventListener("click", shareTimeCardImage);
}

initialise();
