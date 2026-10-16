"use strict";

const PUBLIC_URL = "https://asobi-gorogoro.vercel.app/";
const GAME_SECONDS = 30;
const HAPPY_MIN = 40;
const POKE_MAX = 8;
const CLOSE_BONUS = 35;
const MAX_BONUS = 40;
const ARRIVE_SECONDS = 0.42;
const WANDER_SECONDS = 4.5;
const BEST_KEY = "asobi:gorogoro:best";

// fill: ごろごろが100までたまる秒数 / limit: ぷいっとなるゲージ値の幅(100以上ならぷいっなし)
// warn: ぷいっの何秒前から「ぴくぴく」するか / mult: 点数の倍率 / fake: フェイントの確率
const CATS = [
  {
    id: "shimaneko", name: "しまねこ", trait: "ツンデレ",
    note: "ごろごろは速いけど、ぷいっも早い。うまくいけば高得点。",
    src: "./assets/cat-shimaneko.png", alt: "灰色のしま模様で、目つきのするどいおすわりの猫",
    fill: 2.3, limit: [36, 80], warn: 0.52, mult: 1.4,
  },
  {
    id: "maruneko", name: "まるねこ", trait: "おおらか",
    note: "なでさせてくれる時間が長め。ゆっくりごろごろ。",
    src: "./assets/cat-maruneko.png", alt: "前足をそろえて丸くなる、オレンジのしま猫",
    fill: 3.3, limit: [62, 120], warn: 0.68, mult: 1,
  },
  {
    id: "mikeneko", name: "みけねこ", trait: "きまぐれ",
    note: "ぴくっとしても、ぷいっとは限らない。フェイントに注意。",
    src: "./assets/cat-mikeneko.png", alt: "ふせて前を見つめる三毛猫",
    fill: 2.8, limit: [30, 105], warn: 0.56, mult: 1.2, fake: 0.45,
  },
  {
    id: "shirofuwa", name: "しろふわ", trait: "あまえんぼ",
    note: "ごろごろが一気にたまる。そのぶん、合図は短め。",
    src: "./assets/cat-shirofuwa.png", alt: "両手両足を広げてよろこぶ、白いふわふわの猫",
    fill: 1.8, limit: [38, 95], warn: 0.44, mult: 1.3,
  },
  {
    id: "nobineko", name: "のびねこ", trait: "ねぼすけ",
    note: "ゆっくりごろごろ。長くなでるほど、MAXが近づく。",
    src: "./assets/cat-nobineko.png", alt: "長いしっぽをたらして眠る、茶しまの猫",
    fill: 4.4, limit: [72, 125], warn: 0.8, mult: 0.9,
  },
];

const RANKS = [
  { min: 0, label: "ねこ見習い" },
  { min: 300, label: "ひざの上の常連" },
  { min: 500, label: "ごろごろ名人" },
  { min: 700, label: "ねこの気持ちがわかる人" },
  { min: 850, label: "ごろごろマスター" },
];

const $ = (selector) => document.querySelector(selector);
const elements = {
  machine: $("#petMachine"),
  pad: $("#petPad"),
  figure: $("#catFigure"),
  sprite: $("#catSprite"),
  catName: $("#catName"),
  catTrait: $("#catTrait"),
  floaters: $("#floaters"),
  hand: $("#hand"),
  hint: $("#padHint"),
  time: $("#timeValue"),
  score: $("#scoreValue"),
  happy: $("#happyValue"),
  gaugeFill: $("#gaugeFill"),
  gaugeValue: $("#gaugeValue"),
  status: $("#statusLine"),
  start: $("#startButton"),
  noteList: $("#noteList"),
  dayText: $("#dayText"),
  bestLine: $("#bestLine"),
  bestValue: $("#bestValue"),
  soundButton: $("#soundButton"),
  soundLabel: $("#soundLabel"),
  volume: $("#volumeControl"),
  volumeValue: $("#volumeValue"),
  dialog: $("#resultDialog"),
  resultKicker: $("#resultKicker"),
  resultRank: $("#resultRank"),
  resultHappy: $("#resultHappy"),
  resultScore: $("#resultScore"),
  resultHuff: $("#resultHuff"),
  resultClose: $("#resultClose"),
  resultBest: $("#resultBest"),
  shareImage: $("#shareImageButton"),
  shareLink: $("#shareLinkButton"),
  shareStatus: $("#shareStatus"),
  retry: $("#retryButton"),
  close: $("#closeButton"),
};

const state = {
  running: false,
  phase: "idle",
  phaseTime: 0,
  timeLeft: GAME_SECONDS,
  score: 0,
  happy: 0,
  huff: 0,
  close: 0,
  visits: 0,
  rank: RANKS[0].label,
  best: 0,
  visit: null,
  lastCatId: "",
  heartTimer: 0,
};

const holds = new Set();
let soundOn = true;
let masterVolume = 0.7;
let lastFrame = 0;
let frameId = 0;
let finishTimer = 0;
let activePointer = null;
const shareArt = new Image();
const rand = (min, max) => min + Math.random() * (max - min);
const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

/* ---------- 音 ---------- */
const audio = (() => {
  let context = null;
  let master = null;
  let noise = null;
  let purr = null;
  let tickTimer = 0;

  function ensure() {
    if (!context) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return null;
      context = new AudioContext();
      master = context.createGain();
      master.connect(context.destination);
      noise = context.createBuffer(1, context.sampleRate * 2, context.sampleRate);
      const data = noise.getChannelData(0);
      for (let i = 0; i < data.length; i += 1) data[i] = Math.random() * 2 - 1;
      applyVolume();
    }
    if (context.state === "suspended") context.resume();
    return context;
  }

  function applyVolume() {
    if (!master) return;
    master.gain.setTargetAtTime(soundOn ? masterVolume : 0, context.currentTime, 0.02);
  }

  function tone(frequency, start, duration, volume, type = "sine") {
    const ctx = ensure();
    if (!ctx) return;
    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();
    const at = ctx.currentTime + start;
    oscillator.type = type;
    oscillator.frequency.value = frequency;
    gain.gain.setValueAtTime(0.0001, at);
    gain.gain.exponentialRampToValueAtTime(volume, at + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, at + duration);
    oscillator.connect(gain).connect(master);
    oscillator.start(at);
    oscillator.stop(at + duration + 0.03);
  }

  function purrStart() {
    const ctx = ensure();
    if (!ctx || purr) return;
    const source = ctx.createBufferSource();
    source.buffer = noise;
    source.loop = true;
    const filter = ctx.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.value = 180;
    filter.Q.value = 0.9;
    const amp = ctx.createGain();
    amp.gain.value = 0.5;
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 22;
    const lfoDepth = ctx.createGain();
    lfoDepth.gain.value = 0.5;
    lfo.connect(lfoDepth).connect(amp.gain);
    const level = ctx.createGain();
    level.gain.value = 0.0001;
    source.connect(filter).connect(amp).connect(level).connect(master);
    source.start();
    lfo.start();
    purr = { source, filter, lfo, level };
  }

  function purrUpdate(gauge, tell) {
    if (!purr || !context) return;
    const now = context.currentTime;
    const amount = clamp(gauge / 100, 0, 1);
    purr.level.gain.setTargetAtTime(0.18 + amount * 0.5, now, 0.05);
    purr.lfo.frequency.setTargetAtTime(21 + amount * 8 + (tell ? 6 : 0), now, 0.05);
    purr.filter.frequency.setTargetAtTime(160 + amount * 150, now, 0.05);
    purr.filter.Q.setTargetAtTime(tell ? 3.2 : 0.9, now, 0.05);
  }

  function purrStop() {
    if (!purr || !context) return;
    const { source, lfo, level } = purr;
    purr = null;
    const now = context.currentTime;
    level.gain.cancelScheduledValues(now);
    level.gain.setTargetAtTime(0.0001, now, 0.03);
    source.stop(now + 0.2);
    lfo.stop(now + 0.2);
  }

  function tickStart() {
    if (tickTimer) return;
    tone(1040, 0, 0.05, 0.12, "triangle");
    tickTimer = window.setInterval(() => tone(1040, 0, 0.05, 0.12, "triangle"), 140);
  }

  function tickStop() {
    window.clearInterval(tickTimer);
    tickTimer = 0;
  }

  function huff() {
    const ctx = ensure();
    if (!ctx) return;
    const source = ctx.createBufferSource();
    source.buffer = noise;
    const filter = ctx.createBiquadFilter();
    filter.type = "highpass";
    filter.frequency.value = 2400;
    const gain = ctx.createGain();
    const now = ctx.currentTime;
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.4, now + 0.03);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.3);
    source.connect(filter).connect(gain).connect(master);
    source.start(now);
    source.stop(now + 0.32);
    const oscillator = ctx.createOscillator();
    const drop = ctx.createGain();
    oscillator.type = "sine";
    oscillator.frequency.setValueAtTime(360, now);
    oscillator.frequency.exponentialRampToValueAtTime(150, now + 0.28);
    drop.gain.setValueAtTime(0.0001, now);
    drop.gain.exponentialRampToValueAtTime(0.2, now + 0.02);
    drop.gain.exponentialRampToValueAtTime(0.0001, now + 0.3);
    oscillator.connect(drop).connect(master);
    oscillator.start(now);
    oscillator.stop(now + 0.32);
  }

  return {
    ensure,
    applyVolume,
    purrStart,
    purrUpdate,
    purrStop,
    tickStart,
    tickStop,
    huff,
    start() { tone(523, 0, 0.14, 0.2); tone(659, 0.09, 0.2, 0.2); },
    poke() { tone(780, 0, 0.06, 0.12, "triangle"); },
    release(gauge, close, max) {
      if (gauge < HAPPY_MIN) {
        tone(520, 0, 0.18, 0.18);
      } else {
        tone(620, 0, 0.18, 0.2);
        tone(784, 0.08, 0.24, 0.2);
      }
      if (close) tone(1046, 0.18, 0.28, 0.16, "triangle");
      if (max) [660, 830, 990, 1320].forEach((frequency, i) => tone(frequency, 0.1 + i * 0.09, 0.3, 0.18));
    },
    finish() { [523, 659, 784].forEach((frequency, i) => tone(frequency, i * 0.12, 0.3, 0.2)); },
  };
})();

function vibrate(pattern) {
  if (soundOn && navigator.vibrate) navigator.vibrate(pattern);
}

/* ---------- 表示 ---------- */
function setStatus(message) {
  elements.status.textContent = message;
}

function setHint(message) {
  elements.hint.textContent = message;
}

function setPhase(phase) {
  state.phase = phase;
  state.phaseTime = 0;
  const { machine, hand } = elements;
  machine.dataset.phase = phase;
  const petting = phase === "petting" || phase === "tell";
  machine.classList.toggle("is-petting", petting);
  hand.classList.toggle("is-stroking", petting);
  if (phase !== "happy") machine.classList.remove("is-max");
}

function spawnFloater(content, className, x, y, sub = "") {
  const node = document.createElement("span");
  node.className = `floater ${className}`;
  node.style.setProperty("--x", `${x}px`);
  node.style.setProperty("--y", `${y}px`);
  node.style.setProperty("--dx", `${rand(-18, 18)}px`);
  node.textContent = content;
  if (sub) {
    const small = document.createElement("small");
    small.textContent = sub;
    node.append(small);
  }
  elements.floaters.append(node);
  window.setTimeout(() => node.remove(), 1500);
}

function padCenter() {
  return { x: elements.pad.clientWidth / 2, y: elements.pad.clientHeight * 0.52 };
}

function spawnHeart() {
  const { x, y } = padCenter();
  const glyph = ["♥", "♪", "♡"][Math.floor(Math.random() * 3)];
  spawnFloater(glyph, "is-heart", x + rand(-80, 80), y + rand(-50, 10));
}

function render() {
  const visit = state.visit;
  const gauge = visit ? clamp(visit.gauge, 0, 100) : 0;
  elements.time.textContent = state.timeLeft.toFixed(1);
  elements.score.textContent = state.score.toLocaleString("ja-JP");
  elements.happy.textContent = state.happy;
  elements.gaugeFill.style.width = `${gauge}%`;
  elements.gaugeValue.textContent = Math.floor(gauge);
}

/* ---------- ゲーム進行 ---------- */
function pickCat() {
  const pool = CATS.filter((cat) => cat.id !== state.lastCatId);
  return pool[Math.floor(Math.random() * pool.length)];
}

function makeVisit(cat) {
  const rate = 100 / cat.fill;
  const limit = rand(cat.limit[0], cat.limit[1]);
  const protectedFromHuff = limit >= 100;
  const warnAt = protectedFromHuff ? Infinity : Math.max(14, limit - rate * cat.warn * rand(0.8, 1.2));
  let fake = null;
  if (cat.fake && Math.random() < cat.fake) {
    const latest = Math.min(warnAt, 96) - rate * 1.2;
    if (latest > 24) fake = { at: rand(16, latest), duration: rand(0.45, 0.65), done: false };
  }
  return {
    cat, rate, limit, warnAt, fake,
    gauge: 0,
    fakeLeft: 0,
    realTell: false,
    patient: state.visits === 0,
    heartScale: 0,
  };
}

function startVisit() {
  const cat = pickCat();
  state.lastCatId = cat.id;
  state.visit = makeVisit(cat);
  state.visits += 1;
  elements.sprite.src = cat.src;
  elements.sprite.classList.toggle("is-flip", Math.random() < 0.5);
  elements.catName.textContent = cat.name;
  elements.catTrait.textContent = cat.trait;
  setHint(state.visits === 1 ? "長押しでなでる(ぴくぴくしたら離す)" : "長押しでなでる");
  setPhase("arriving");
  render();
}

function beginPetting() {
  state.visit.gauge = 0;
  state.visit.heartScale = 0;
  state.heartTimer = 0;
  setPhase("petting");
  setHint("そのまま、ごろごろ…");
  audio.purrStart();
  audio.purrUpdate(0, false);
}

function reactionLabel(gauge, max) {
  if (max) return "ごろごろMAX!";
  if (gauge < HAPPY_MIN) return "まだ足りない";
  if (gauge < 70) return "ごきげん";
  return "ごろごろ♪";
}

function settle(max = false) {
  const visit = state.visit;
  const gauge = max ? 100 : clamp(Math.floor(visit.gauge), 0, 100);
  const close = visit.realTell && !max;
  let points = Math.round(gauge * visit.cat.mult);
  if (close) { points += CLOSE_BONUS; state.close += 1; }
  if (max) points += MAX_BONUS;
  state.score += points;
  if (gauge >= HAPPY_MIN) state.happy += 1;

  const label = reactionLabel(gauge, max);
  const tag = max ? label : close ? "ギリギリ!" : label;
  const { x, y } = padCenter();
  spawnFloater(`+${points}`, "is-score", x, y - 36, tag);
  setStatus(`${visit.cat.name}は「${label}」。+${points}点${close ? "(ギリギリ!)" : ""}`);
  setHint(label);
  visit.holdTime = max ? 0.95 : 0.75;
  elements.machine.classList.toggle("is-max", max);
  setPhase("happy");
  audio.tickStop();
  audio.purrStop();
  audio.release(gauge, close, max);
  vibrate(max ? [20, 40, 20, 40, 30] : 18);
  if (max) for (let i = 0; i < 6; i += 1) spawnFloater("✦", "is-heart", x + rand(-110, 110), y + rand(-70, 20));
}

function huffNow() {
  const visit = state.visit;
  state.huff += 1;
  setStatus(`${visit.cat.name}に、ぷいっ!とされた…。0点`);
  setHint("ぷいっ!");
  const { x, y } = padCenter();
  spawnFloater("+0", "is-score is-miss", x, y - 36);
  setPhase("huff");
  audio.tickStop();
  audio.purrStop();
  audio.huff();
  vibrate([40, 30, 40]);
}

function endPetting() {
  const visit = state.visit;
  audio.tickStop();
  if (visit.gauge < POKE_MAX) {
    audio.purrStop();
    audio.poke();
    visit.gauge = 0;
    visit.realTell = false;
    visit.fakeLeft = 0;
    setPhase("waiting");
    setHint("長押しでなでる");
    setStatus("ちょん。長押しで、ゆっくりなでてみよう。");
    render();
    return;
  }
  settle(false);
}

function updatePetting(dt) {
  const visit = state.visit;
  visit.gauge += visit.rate * dt;

  if (visit.fake && !visit.fake.done && visit.gauge >= visit.fake.at) {
    visit.fake.done = true;
    visit.fakeLeft = visit.fake.duration;
  }
  const faking = visit.fakeLeft > 0;
  if (faking) visit.fakeLeft -= dt;
  visit.realTell = visit.gauge >= visit.warnAt;
  const tell = visit.realTell || faking;

  if (tell && state.phase === "petting") {
    setPhase("tell");
    setHint("いま離して!");
    setStatus("ぴくぴく…! 離して!");
    audio.tickStart();
    vibrate(12);
  } else if (!tell && state.phase === "tell") {
    setPhase("petting");
    setHint("そのまま、ごろごろ…");
    audio.tickStop();
    if (faking === false && visit.fake?.done) setStatus("いまのはフェイント。まだ大丈夫。");
  }

  audio.purrUpdate(visit.gauge, tell);

  if (visit.realTell && visit.gauge >= visit.limit) {
    huffNow();
    return;
  }
  if (visit.gauge >= 100) {
    visit.gauge = 100;
    settle(true);
    return;
  }

  state.heartTimer -= dt;
  if (!tell && state.heartTimer <= 0) {
    spawnHeart();
    state.heartTimer = 0.55 - 0.4 * clamp(visit.gauge / 100, 0, 1);
  }
}

function tick(dt) {
  state.timeLeft = Math.max(0, state.timeLeft - dt);
  state.phaseTime += dt;
  const visit = state.visit;

  switch (state.phase) {
    case "arriving":
      if (state.phaseTime >= ARRIVE_SECONDS) setPhase("waiting");
      break;
    case "waiting":
      if (!visit.patient && state.phaseTime >= WANDER_SECONDS) {
        setStatus(`${visit.cat.name}は行ってしまった…`);
        setHint("…");
        setPhase("wander");
      }
      break;
    case "petting":
    case "tell":
      updatePetting(dt);
      break;
    case "happy":
      if (state.phaseTime >= visit.holdTime) setPhase("leaving");
      break;
    case "huff":
      if (state.phaseTime >= 0.85) setPhase("leaving");
      break;
    case "wander":
      if (state.phaseTime >= 0.52) startVisit();
      break;
    case "leaving":
      if (state.phaseTime >= 0.34) startVisit();
      break;
    default:
      break;
  }

  if (state.timeLeft <= 0) {
    finishGame();
    return;
  }
  render();
}

function frame(now) {
  if (!state.running) return;
  const dt = Math.min(0.1, (now - lastFrame) / 1000);
  lastFrame = now;
  tick(dt);
  if (state.running) frameId = requestAnimationFrame(frame);
}

function rankFor(score) {
  return [...RANKS].reverse().find((rank) => score >= rank.min).label;
}

function readBest() {
  try {
    return Number(window.localStorage.getItem(BEST_KEY)) || 0;
  } catch {
    return 0;
  }
}

function saveBest(score) {
  try {
    window.localStorage.setItem(BEST_KEY, String(score));
  } catch {
    /* 保存できなくても遊べる */
  }
}

function showBest() {
  elements.bestLine.hidden = state.best <= 0;
  elements.bestValue.textContent = state.best.toLocaleString("ja-JP");
}

function startGame() {
  if (state.running) return;
  audio.ensure();
  window.clearTimeout(finishTimer);
  if (elements.dialog.open) elements.dialog.close();
  Object.assign(state, {
    running: true,
    timeLeft: GAME_SECONDS,
    score: 0, happy: 0, huff: 0, close: 0, visits: 0,
    visit: null, lastCatId: "",
  });
  elements.floaters.replaceChildren();
  elements.machine.classList.add("is-playing");
  setStatus("猫を長押しでなでます。ぴくぴくしたら、手を離して。");
  audio.start();
  startVisit();
  elements.pad.focus({ preventScroll: true });
  lastFrame = performance.now();
  frameId = requestAnimationFrame(frame);
}

function finishGame() {
  state.running = false;
  cancelAnimationFrame(frameId);
  holds.clear();
  if (state.phase === "petting" || state.phase === "tell") {
    if (state.visit.gauge >= POKE_MAX) settle(false);
    else { audio.tickStop(); audio.purrStop(); }
  }
  audio.tickStop();
  audio.purrStop();
  render();
  elements.machine.classList.remove("is-playing");
  elements.hand.classList.remove("is-on");
  setPhase("over");
  setHint("おつかれさま");
  finishTimer = window.setTimeout(showResult, 900);
}

function showResult() {
  state.rank = rankFor(state.score);
  const isNewBest = state.score > state.best;
  if (isNewBest) {
    state.best = state.score;
    saveBest(state.best);
  }
  showBest();
  elements.resultKicker.textContent = `${GAME_SECONDS}秒、おつかれさまでした`;
  elements.resultRank.textContent = state.rank;
  elements.resultHappy.textContent = state.happy;
  elements.resultScore.textContent = state.score.toLocaleString("ja-JP");
  elements.resultHuff.textContent = state.huff;
  elements.resultClose.textContent = state.close;
  elements.resultBest.hidden = state.score <= 0;
  elements.resultBest.replaceChildren();
  if (isNewBest && state.score > 0) {
    elements.resultBest.append("ベストスコア更新!");
  } else {
    elements.resultBest.append("ベストスコア ");
    const strong = document.createElement("strong");
    strong.textContent = `${state.best.toLocaleString("ja-JP")}点`;
    elements.resultBest.append(strong);
  }
  setShareStatus(shareReadyMessage());
  audio.finish();
  if (!elements.dialog.open) elements.dialog.showModal();
  elements.retry.focus();
}

/* ---------- 入力 ---------- */
function press(source) {
  if (holds.has(source)) return;
  const wasHolding = holds.size > 0;
  holds.add(source);
  if (!state.running) {
    setStatus("「30秒ではじめる」を押してね。");
    return;
  }
  if (!wasHolding && (state.phase === "arriving" || state.phase === "waiting")) beginPetting();
}

function release(source) {
  if (!holds.delete(source) || holds.size > 0) return;
  if (state.running && (state.phase === "petting" || state.phase === "tell")) {
    endPetting();
    render();
  }
}

function releaseAll() {
  const sources = [...holds];
  sources.forEach(release);
  activePointer = null;
}

function moveHand(event) {
  if (!state.running) {
    elements.hand.classList.remove("is-on");
    return;
  }
  const rect = elements.pad.getBoundingClientRect();
  elements.hand.style.setProperty("--hx", `${event.clientX - rect.left}px`);
  elements.hand.style.setProperty("--hy", `${event.clientY - rect.top}px`);
  elements.hand.classList.toggle("is-touch", event.pointerType === "touch");
  elements.hand.classList.add("is-on");
}

elements.pad.addEventListener("pointerdown", (event) => {
  if (event.pointerType === "mouse" && event.button !== 0) return;
  event.preventDefault();
  moveHand(event);
  if (activePointer !== null) return;
  activePointer = event.pointerId;
  try { elements.pad.setPointerCapture(event.pointerId); } catch { /* 取れなくても動く */ }
  press("pointer");
});

elements.pad.addEventListener("pointermove", moveHand);

const endPointer = (event) => {
  if (event.pointerId !== activePointer) return;
  activePointer = null;
  release("pointer");
  if (event.pointerType !== "mouse") elements.hand.classList.remove("is-on");
};

elements.pad.addEventListener("pointerup", endPointer);
elements.pad.addEventListener("pointercancel", endPointer);
elements.pad.addEventListener("lostpointercapture", endPointer);
elements.pad.addEventListener("pointerleave", (event) => {
  if (event.pointerType === "mouse" && activePointer === null) elements.hand.classList.remove("is-on");
});
elements.pad.addEventListener("contextmenu", (event) => event.preventDefault());

elements.pad.addEventListener("keydown", (event) => {
  if (event.code !== "Space" && event.key !== "Enter") return;
  event.preventDefault();
  if (event.repeat) return;
  if (!state.running && !elements.dialog.open) {
    startGame();
    return;
  }
  press("key");
});

elements.pad.addEventListener("keyup", (event) => {
  if (event.code !== "Space" && event.key !== "Enter") return;
  event.preventDefault();
  release("key");
});

elements.pad.addEventListener("blur", () => release("key"));
window.addEventListener("blur", releaseAll);
document.addEventListener("visibilitychange", () => {
  if (document.hidden) releaseAll();
});

elements.start.addEventListener("click", startGame);
elements.retry.addEventListener("click", () => {
  elements.dialog.close();
  startGame();
});
elements.close.addEventListener("click", () => elements.dialog.close());
elements.dialog.addEventListener("close", () => {
  if (!state.running) {
    setHint("はじめるを押してね");
    elements.start.focus({ preventScroll: true });
  }
});

/* ---------- 音量 ---------- */
function updateSoundUi() {
  elements.soundButton.setAttribute("aria-pressed", String(soundOn));
  elements.soundLabel.textContent = soundOn ? "音あり" : "音なし";
  const percent = Math.round(masterVolume * 100);
  elements.volumeValue.textContent = `${percent}%`;
  elements.volume.style.setProperty("--volume-fill", `${percent}%`);
  elements.volume.value = percent;
  audio.applyVolume();
}

elements.soundButton.addEventListener("click", () => {
  soundOn = !soundOn;
  if (soundOn) audio.ensure();
  updateSoundUi();
});

elements.volume.addEventListener("input", () => {
  masterVolume = clamp(Number(elements.volume.value) / 100, 0, 1);
  if (masterVolume > 0 && !soundOn) soundOn = true;
  if (soundOn) audio.ensure();
  updateSoundUi();
});

/* ---------- 共有 ---------- */
function shareReadyMessage() {
  return supportsFileShareEnvironment()
    ? "共有先でXを選ぶだけです。"
    : `画像をコピーしてXの投稿画面を開きます。Xでは自動で貼られないので、投稿欄で${pasteShortcutLabel()}を押してください。`;
}

function setShareStatus(message) {
  elements.shareStatus.textContent = message;
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

function canvasToFile(canvas, filename) {
  return new Promise((resolve) => {
    let settled = false;
    const finish = (file) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timeoutId);
      resolve(file);
    };
    const timeoutId = window.setTimeout(() => finish(null), 3000);
    try {
      canvas.toBlob((blob) => {
        finish(blob ? new File([blob], filename, { type: "image/png" }) : null);
      }, "image/png");
    } catch {
      finish(null);
    }
  });
}

async function loadShareFonts() {
  if (!document.fonts?.load) return;
  const timeout = new Promise((resolve) => window.setTimeout(resolve, 800));
  await Promise.race([
    Promise.all([
      document.fonts.load('800 31px "M PLUS Rounded 1c"'),
      document.fonts.load('700 22px "Zen Kaku Gothic New"'),
    ]).catch(() => {}),
    timeout,
  ]);
}

async function createShareCard() {
  if (!shareArt.complete || !shareArt.naturalWidth || typeof File === "undefined") return null;
  await loadShareFonts();

  const canvas = document.createElement("canvas");
  canvas.width = 1200;
  canvas.height = 630;
  const context = canvas.getContext("2d");
  if (!context) return null;

  context.drawImage(shareArt, 0, 0, canvas.width, canvas.height);
  drawRoundedRect(context, 58, 54, 490, 522, 34);
  context.fillStyle = "rgba(255, 248, 234, .92)";
  context.fill();
  context.strokeStyle = "rgba(48, 40, 31, .72)";
  context.lineWidth = 3;
  context.stroke();

  context.fillStyle = "#30281f";
  context.font = '800 31px "M PLUS Rounded 1c", "Hiragino Sans", sans-serif';
  context.fillText("asobi  ごろごろ限界", 105, 118);
  context.fillStyle = "#a86c49";
  context.font = '700 22px "Zen Kaku Gothic New", "Hiragino Sans", sans-serif';
  context.fillText(`「${state.rank}」`, 105, 175);

  context.fillStyle = "#e88724";
  context.font = '800 76px "M PLUS Rounded 1c", "Hiragino Sans", sans-serif';
  context.fillText(`${state.happy}匹`, 98, 283);
  context.fillStyle = "#30281f";
  context.font = '800 34px "M PLUS Rounded 1c", "Hiragino Sans", sans-serif';
  context.fillText("をごきげんにしました。", 104, 338);

  context.fillStyle = "#f2bd32";
  drawRoundedRect(context, 96, 379, 414, 68, 18);
  context.fill();
  context.strokeStyle = "#30281f";
  context.lineWidth = 3;
  context.stroke();
  context.fillStyle = "#30281f";
  context.font = '800 24px "M PLUS Rounded 1c", "Hiragino Sans", sans-serif';
  context.fillText(`スコア  ${state.score.toLocaleString("ja-JP")}`, 125, 422);

  context.fillStyle = "#65594e";
  context.font = '700 20px "Zen Kaku Gothic New", "Hiragino Sans", sans-serif';
  context.fillText(`ぷいっ ${state.huff}回　ギリギリ ${state.close}回`, 104, 493);
  context.fillStyle = "#a86c49";
  context.font = '700 18px "Zen Kaku Gothic New", "Hiragino Sans", sans-serif';
  context.fillText("#ごろごろ限界 #グローバルキャットデー", 104, 536);

  return canvasToFile(canvas, "gorogoro-result.png");
}

function resultShareText(includeUrl = false) {
  let text =
    `ごろごろ限界で${state.happy}匹をごきげんにして、${state.score.toLocaleString("ja-JP")}点。「${state.rank}」\n` +
    `ぷいっ ${state.huff}回 / ギリギリ ${state.close}回`;
  if (includeUrl) text += `\n\n${PUBLIC_URL}`;
  text += "\n\n#ごろごろ限界 #グローバルキャットデー";
  return text;
}

function openXShare() {
  const params = new URLSearchParams({ text: resultShareText(), url: PUBLIC_URL });
  window.location.assign(`https://twitter.com/intent/tweet?${params.toString()}`);
}

async function copyImageToClipboard(file) {
  if (!navigator.clipboard?.write || typeof ClipboardItem === "undefined") return false;
  try {
    const timeout = new Promise((_, reject) => {
      window.setTimeout(() => reject(new Error("Clipboard timeout")), 2500);
    });
    await Promise.race([
      navigator.clipboard.write([new ClipboardItem({ "image/png": file })]),
      timeout,
    ]);
    return true;
  } catch {
    return false;
  }
}

function supportsFileShareEnvironment() {
  const isMobileDevice = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent)
    || (/Macintosh/i.test(navigator.userAgent) && navigator.maxTouchPoints > 1);
  return isMobileDevice && Boolean(navigator.share) && Boolean(navigator.canShare);
}

function pasteShortcutLabel() {
  return /Macintosh|Mac OS X/i.test(navigator.userAgent) ? "⌘V" : "Ctrl+V";
}

function supportsNativeFileShare(file) {
  if (!supportsFileShareEnvironment()) return false;
  try {
    return navigator.canShare({ files: [file] });
  } catch {
    return false;
  }
}

function downloadShareImage(file) {
  const url = URL.createObjectURL(file);
  const link = document.createElement("a");
  link.href = url;
  link.download = file.name;
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function downloadFallbackShareImage() {
  const link = document.createElement("a");
  link.href = "./og-image.png";
  link.download = "gorogoro-result.png";
  document.body.append(link);
  link.click();
  link.remove();
}

async function shareResultImage() {
  elements.shareImage.disabled = true;
  setShareStatus("共有画像を作っています…");
  try {
    const file = await createShareCard();
    if (!file) {
      downloadFallbackShareImage();
      setShareStatus("OGP画像を保存しました。Xの投稿に添付してください。");
      window.setTimeout(openXShare, 650);
      return;
    }

    const shareData = { title: "ごろごろ限界", text: resultShareText(true), files: [file] };
    if (supportsNativeFileShare(file)) {
      await navigator.share(shareData);
      setShareStatus("共有しました。");
      return;
    }

    const copied = await copyImageToClipboard(file);
    if (copied) {
      setShareStatus(`画像をコピーしました。Xの投稿欄で${pasteShortcutLabel()}を押して貼り付けてください。`);
    } else {
      downloadShareImage(file);
      setShareStatus("画像を保存しました。Xの投稿に添付してください。");
    }
    window.setTimeout(openXShare, 650);
  } catch (error) {
    if (error?.name === "AbortError") {
      setShareStatus("共有をキャンセルしました。");
    } else {
      downloadFallbackShareImage();
      setShareStatus("OGP画像を保存しました。Xの投稿に添付してください。");
      window.setTimeout(openXShare, 650);
    }
  } finally {
    elements.shareImage.disabled = false;
  }
}

function prepareShareArt() {
  shareArt.addEventListener("load", () => {
    elements.shareImage.disabled = false;
    setShareStatus(shareReadyMessage());
  }, { once: true });
  shareArt.addEventListener("error", () => {
    setShareStatus("共有画像を読み込めませんでした。再読み込みしてください。");
  }, { once: true });
  shareArt.src = "./og-art.png";
}

elements.shareImage.addEventListener("click", shareResultImage);
elements.shareLink.addEventListener("click", openXShare);

/* ---------- 初期化 ---------- */
function renderCatNotes() {
  elements.noteList.innerHTML = CATS.map((cat) => `
    <li class="note-entry">
      <img src="${cat.src}" alt="${cat.alt}" loading="lazy" decoding="async" />
      <div>
        <header><h3>${cat.name}</h3><small>${cat.trait}</small></header>
        <p>${cat.note}</p>
      </div>
    </li>`).join("");
}

function init() {
  const today = new Date();
  if (today.getMonth() === 9 && today.getDate() === 16) {
    elements.dayText.textContent = "今日はグローバルキャットデー!";
  }
  CATS.forEach((cat) => { new Image().src = cat.src; });
  renderCatNotes();
  state.best = readBest();
  showBest();
  updateSoundUi();
  prepareShareArt();
  render();
}

init();
