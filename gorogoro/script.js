"use strict";

const PUBLIC_URL = "https://asobi-gorogoro.vercel.app/";
const GAME_SECONDS = 30;
const POKE_MAX = 8;
const BASE_WEIGHT = 0.6;
const BONUS_MAX = 150;
const MAX_BONUS = 80;
const PERFECT_RATIO = 0.88;
const HUFF_PENALTY = 1.5;
const COMBO_STEP = 0.1;
const COMBO_CAP = 5;
const RUSH_AT = 8;
const RUSH_MULT = 1.5;
const SHINY_CHANCE = 0.16;
const SHINY_FROM_VISIT = 3;
const SHINY_MAX = 2;
const SHINY_MULT = 2.5;
const ARRIVE_SECONDS = 0.42;
const WANDER_SECONDS = 4.5;
const BEST_KEY = "asobi:gorogoro:best";

// 猫ごとのごろごろの進み方(ゲージ0〜1の位置での速さの倍率)
const CURVES = {
  steady: () => 1,
  excited: (t) => 0.65 + 0.95 * t,
  sleepy: (t) => 0.4 + 1.0 * t,
};

// fill: ごろごろが100までたまる秒数の目安 / limit: ぷいっとなるゲージ値の幅(100以上ならぷいっなし)
// warn: 「!」が出てからぷいっまでの秒数 / mult: 点数の倍率 / fake: 「!」なしでぴくっとするフェイントの確率
const CATS = [
  {
    id: "shimaneko", name: "しまねこ", trait: "ツンデレ",
    note: "ごろごろは速め、「!」は短め。決めれば高得点。",
    src: "./assets/cat-shimaneko.png", alt: "灰色のしま模様で、目つきのするどいおすわりの猫",
    fill: 2.3, limit: [36, 80], warn: 0.72, mult: 1.4, curve: "steady",
  },
  {
    id: "maruneko", name: "まるねこ", trait: "おおらか",
    note: "ぷいっが遠くて、MAXまでなでられることも。",
    src: "./assets/cat-maruneko.png", alt: "前足をそろえて丸くなる、オレンジのしま猫",
    fill: 3.3, limit: [60, 125], warn: 1.0, mult: 1, curve: "steady",
  },
  {
    id: "mikeneko", name: "みけねこ", trait: "きまぐれ",
    note: "ぴくっとしても、「!」が出なければセーフ。",
    src: "./assets/cat-mikeneko.png", alt: "ふせて前を見つめる三毛猫",
    fill: 2.8, limit: [30, 108], warn: 0.85, mult: 1.2, fake: 0.5, curve: "steady",
  },
  {
    id: "shirofuwa", name: "しろふわ", trait: "あまえんぼ",
    note: "なでるほど、どんどん速くなる。「!」から一気に来る。",
    src: "./assets/cat-shirofuwa.png", alt: "両手両足を広げてよろこぶ、白いふわふわの猫",
    fill: 2.4, limit: [38, 98], warn: 0.66, mult: 1.3, curve: "excited",
  },
  {
    id: "nobineko", name: "のびねこ", trait: "ねぼすけ",
    note: "最初はゆっくり、あとから加速。起きる前がねらい目。",
    src: "./assets/cat-nobineko.png", alt: "長いしっぽをたらして眠る、茶しまの猫",
    fill: 4, limit: [66, 125], warn: 1.0, mult: 1.1, curve: "sleepy",
  },
];

const RANKS = [
  { min: 0, label: "ねこ見習い" },
  { min: 800, label: "ひざの上の常連" },
  { min: 1300, label: "ごろごろ名人" },
  { min: 1900, label: "ねこの気持ちがわかる人" },
  { min: 2500, label: "ごろごろマスター" },
];

const $ = (selector) => document.querySelector(selector);
const elements = {
  machine: $("#petMachine"),
  pad: $("#petPad"),
  figure: $("#catFigure"),
  sprite: $("#catSprite"),
  tag: $("#catTag"),
  catName: $("#catName"),
  catTrait: $("#catTrait"),
  floaters: $("#floaters"),
  hand: $("#hand"),
  hint: $("#padHint"),
  timeTile: $("#timeTile"),
  time: $("#timeValue"),
  score: $("#scoreValue"),
  comboTile: $("#comboTile"),
  comboLabel: $("#comboLabel"),
  combo: $("#comboValue"),
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
  resultPetted: $("#resultPetted"),
  resultScore: $("#resultScore"),
  resultCombo: $("#resultCombo"),
  resultPerfect: $("#resultPerfect"),
  resultHuff: $("#resultHuff"),
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
  petted: 0,
  combo: 0,
  bestCombo: 0,
  perfect: 0,
  huff: 0,
  visits: 0,
  shinies: 0,
  rush: false,
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
let lastHint = "";
const shareArt = new Image();
const rand = (min, max) => min + Math.random() * (max - min);
const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

/* ---------- 音 ---------- */
const audio = (() => {
  let context = null;
  let master = null;
  let noise = null;
  let purr = null;

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
    huff,
    // 「!」の間じゅう鳴る時計。ぷいっに近づくほど音が高く、間隔が短くなる
    tick(ratio) { tone(820 + ratio * 760, 0, 0.05, 0.1 + ratio * 0.08, "triangle"); },
    start() { tone(523, 0, 0.14, 0.2); tone(659, 0.09, 0.2, 0.2); },
    poke() { tone(780, 0, 0.06, 0.12, "triangle"); },
    release({ combo, perfect, max }) {
      const lift = 1 + Math.min(combo, COMBO_CAP) * 0.06;
      tone(620 * lift, 0, 0.18, 0.2);
      tone(784 * lift, 0.08, 0.24, 0.2);
      if (perfect) [1046, 1318, 1568].forEach((frequency, i) => tone(frequency, 0.16 + i * 0.07, 0.26, 0.15, "triangle"));
      if (max) [660, 830, 990, 1320].forEach((frequency, i) => tone(frequency, 0.1 + i * 0.09, 0.3, 0.18));
    },
    sparkle() { [1175, 1480, 1760, 2349].forEach((frequency, i) => tone(frequency, i * 0.07, 0.3, 0.11, "triangle")); },
    rush() { [392, 523, 659, 784].forEach((frequency, i) => tone(frequency, i * 0.08, 0.22, 0.17, "square")); },
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
  if (message === lastHint) return;
  lastHint = message;
  elements.hint.textContent = message;
}

function setPhase(phase) {
  state.phase = phase;
  state.phaseTime = 0;
  const { machine, hand, figure } = elements;
  machine.dataset.phase = phase;
  const petting = phase === "petting" || phase === "tell";
  machine.classList.toggle("is-petting", petting);
  hand.classList.toggle("is-stroking", petting);
  if (!petting) {
    machine.classList.remove("is-twitch");
    figure.style.setProperty("--tell", "0");
  }
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
  window.setTimeout(() => node.remove(), 1600);
}

function padCenter() {
  return { x: elements.pad.clientWidth / 2, y: elements.pad.clientHeight * 0.52 };
}

function spawnHeart() {
  const { x, y } = padCenter();
  const glyph = ["♥", "♪", "♡"][Math.floor(Math.random() * 3)];
  spawnFloater(glyph, "is-heart", x + rand(-80, 80), y + rand(-50, 10));
}

function burst(glyph, count) {
  const { x, y } = padCenter();
  for (let i = 0; i < count; i += 1) spawnFloater(glyph, "is-heart is-star", x + rand(-120, 120), y + rand(-80, 30));
}

function comboMultiplier() {
  return 1 + COMBO_STEP * Math.min(state.combo, COMBO_CAP);
}

function formatMultiplier(value) {
  return `×${value.toFixed(2).replace(/0$/, "").replace(/\.0$/, "")}`;
}

function render() {
  const visit = state.visit;
  const gauge = visit ? clamp(visit.gauge, 0, 100) : 0;
  elements.time.textContent = state.timeLeft.toFixed(1);
  elements.score.textContent = state.score.toLocaleString("ja-JP");
  elements.combo.textContent = formatMultiplier(comboMultiplier());
  elements.comboLabel.textContent = state.combo > 0 ? `コンボ ${state.combo}` : "コンボ";
  elements.comboTile.classList.toggle("is-hot", state.combo >= 3);
  elements.gaugeFill.style.width = `${gauge}%`;
  elements.gaugeValue.textContent = Math.floor(gauge);
}

/* ---------- 猫と点数 ---------- */
function rateAt(visit, gauge) {
  return visit.rate * CURVES[visit.cat.curve](clamp(gauge / 100, 0, 1));
}

// ゲージを from から to まで進めるのにかかる秒数
function timeBetween(visit, from, to) {
  let seconds = 0;
  let gauge = from;
  while (gauge < to) {
    const step = Math.min(0.5, to - gauge);
    seconds += step / rateAt(visit, gauge + step / 2);
    gauge += step;
  }
  return seconds;
}

// 難しさは、時間が進むほど少しずつ上がる(「!」の長さが最大22%短くなる)
function warnRamp() {
  return 1 - 0.22 * (1 - state.timeLeft / GAME_SECONDS);
}

function makeVisit(cat, { first = false, shiny = false } = {}) {
  const rate = 100 / cat.fill;
  let limit = rand(cat.limit[0], cat.limit[1]);
  let warn = cat.warn * warnRamp();
  let mult = cat.mult;
  if (first) {
    // 最初の1匹は、「!」がはっきり出る教える役
    limit = rand(62, 82);
    warn = 1.15;
  }
  if (shiny) {
    limit = rand(46, 86);
    warn *= 0.78;
    mult *= SHINY_MULT;
  }

  const visit = {
    cat, rate, mult, shiny,
    gauge: 0,
    limit: limit >= 100 ? Infinity : limit,
    warnAt: Infinity,
    warnTime: 0,
    tellElapsed: 0,
    tickIn: 0,
    fake: null,
    fakeLeft: 0,
    patient: first,
    holdTime: 0.6,
  };

  if (visit.limit !== Infinity) {
    let gauge = visit.limit;
    let seconds = 0;
    while (gauge > 14 && seconds < warn) {
      seconds += 0.5 / rateAt(visit, gauge - 0.25);
      gauge -= 0.5;
    }
    visit.warnAt = gauge;
    visit.warnTime = seconds;
  }

  if (cat.fake && !first && !shiny && Math.random() < cat.fake) {
    const duration = rand(0.45, 0.65);
    const last = Math.min(visit.warnAt, 96) - 8;
    for (let attempt = 0; attempt < 6; attempt += 1) {
      const at = rand(16, Math.max(17, last));
      if (at < last && timeBetween(visit, at, Math.min(visit.warnAt, 100)) > duration + 0.35) {
        visit.fake = { at, duration, done: false };
        break;
      }
    }
  }
  return visit;
}

function tellRatio(visit) {
  return visit.warnTime > 0 ? clamp(visit.tellElapsed / visit.warnTime, 0, 1) : 0;
}

// 「!」が出てから離すのが遅いほど、ボーナスが大きくなる
function pointsFor(visit, gauge, ratio, max = false) {
  const raw = gauge * BASE_WEIGHT + BONUS_MAX * ratio ** 2 + (max ? MAX_BONUS : 0);
  return Math.round(raw * visit.mult * comboMultiplier() * (state.rush ? RUSH_MULT : 1));
}

function pickCat() {
  const pool = CATS.filter((cat) => cat.id !== state.lastCatId);
  return pool[Math.floor(Math.random() * pool.length)];
}

/* ---------- ゲーム進行 ---------- */
function startVisit() {
  let visit;
  if (state.visits === 0) {
    visit = makeVisit(CATS.find((cat) => cat.id === "maruneko"), { first: true });
  } else {
    const shiny = state.visits >= SHINY_FROM_VISIT && state.shinies < SHINY_MAX && Math.random() < SHINY_CHANCE;
    visit = makeVisit(pickCat(), { shiny });
  }
  const { cat } = visit;
  if (visit.shiny) state.shinies += 1;
  state.lastCatId = cat.id;
  state.visit = visit;
  state.visits += 1;
  elements.sprite.src = cat.src;
  elements.sprite.classList.toggle("is-flip", Math.random() < 0.5);
  elements.sprite.classList.toggle("is-shiny", visit.shiny);
  elements.tag.classList.toggle("is-shiny", visit.shiny);
  elements.catName.textContent = visit.shiny ? `ひかる${cat.name}` : cat.name;
  elements.catTrait.textContent = visit.shiny ? `ごほうび${formatMultiplier(SHINY_MULT)}` : cat.trait;
  setHint(state.visits === 1 ? "長押しでなでる。「!」が出たら離す" : "長押しでなでる");
  setPhase("arriving");
  if (visit.shiny) {
    audio.sparkle();
    burst("✦", 6);
    setStatus(`ひかる${cat.name}があらわれた! 点数${formatMultiplier(SHINY_MULT)}。ぷいっも早いよ。`);
  }
  render();
}

function beginPetting() {
  state.visit.gauge = 0;
  state.visit.tellElapsed = 0;
  state.heartTimer = 0;
  setPhase("petting");
  setHint("そのまま、ごろごろ…");
  audio.purrStart();
  audio.purrUpdate(0, false);
}

function marginText(visit, max) {
  if (max) return "";
  if (visit.limit === Infinity) return "この子は、まだまだ余裕だった。";
  const seconds = timeBetween(visit, clamp(visit.gauge, 0, visit.limit), visit.limit);
  return `あと${seconds.toFixed(2)}秒でぷいっ!だった。`;
}

function settle(max = false) {
  const visit = state.visit;
  const gauge = max ? 100 : clamp(Math.floor(visit.gauge), 0, 100);
  const ratio = max ? 0 : tellRatio(visit);
  const points = pointsFor(visit, gauge, ratio, max);
  const perfect = ratio >= PERFECT_RATIO;
  const margin = marginText(visit, max);

  state.score += points;
  state.petted += 1;
  state.combo += perfect ? 2 : 1;
  state.bestCombo = Math.max(state.bestCombo, state.combo);
  if (perfect) state.perfect += 1;

  let tag = "そっと";
  if (max) tag = "ごろごろMAX!";
  else if (perfect) tag = "パーフェクト!";
  else if (ratio >= 0.5) tag = "ギリギリ!";
  else if (ratio > 0) tag = "ひやっ";

  const { x, y } = padCenter();
  spawnFloater(`+${points}`, `is-score${perfect || max ? " is-big" : ""}`, x, y - 36, tag);
  setStatus(`${visit.cat.name}をなでた。+${points}点。${margin}`);
  setHint(tag);
  visit.holdTime = max || perfect ? 0.8 : 0.6;
  elements.machine.classList.toggle("is-max", max || perfect);
  setPhase("happy");
  audio.purrStop();
  audio.release({ combo: state.combo, perfect, max });
  vibrate(max || perfect ? [20, 40, 20, 40, 30] : 18);
  if (max || perfect) burst("✦", 6);
}

function huffNow() {
  const visit = state.visit;
  state.huff += 1;
  state.combo = 0;
  state.timeLeft = Math.max(0, state.timeLeft - HUFF_PENALTY);
  setStatus(`${visit.cat.name}に、ぷいっ!とされた…。0点、${HUFF_PENALTY}秒ロス。`);
  setHint("ぷいっ!");
  const { x, y } = padCenter();
  spawnFloater("+0", "is-score is-miss", x, y - 36, `-${HUFF_PENALTY}秒`);
  elements.timeTile.classList.add("is-hit");
  window.setTimeout(() => elements.timeTile.classList.remove("is-hit"), 600);
  setPhase("huff");
  audio.purrStop();
  audio.huff();
  vibrate([40, 30, 40]);
}

function endPetting() {
  const visit = state.visit;
  if (visit.gauge < POKE_MAX) {
    audio.purrStop();
    audio.poke();
    visit.gauge = 0;
    visit.tellElapsed = 0;
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
  visit.gauge = Math.min(100, visit.gauge + rateAt(visit, visit.gauge) * dt);

  if (visit.fake && !visit.fake.done && visit.gauge >= visit.fake.at) {
    visit.fake.done = true;
    visit.fakeLeft = visit.fake.duration;
  }
  const twitching = visit.fakeLeft > 0;
  if (twitching) visit.fakeLeft -= dt;

  const realTell = visit.gauge >= visit.warnAt;
  if (realTell) visit.tellElapsed += dt;
  const ratio = tellRatio(visit);

  if (realTell && state.phase === "petting") {
    setPhase("tell");
    setStatus("「!」が出た! 遅く離すほど高得点。でも、ぷいっの前に。");
    vibrate(12);
  }
  elements.machine.classList.toggle("is-twitch", twitching && !realTell);
  elements.figure.style.setProperty("--tell", (realTell ? 0.4 + 0.6 * ratio : twitching ? 0.3 : 0).toFixed(2));

  if (realTell) {
    setHint(`いま離すと +${pointsFor(visit, Math.floor(visit.gauge), ratio)}`);
    visit.tickIn -= dt;
    if (visit.tickIn <= 0) {
      audio.tick(ratio);
      visit.tickIn = 0.22 - 0.16 * ratio;
    }
  }
  audio.purrUpdate(visit.gauge, realTell);

  if (realTell && visit.gauge >= visit.limit) {
    huffNow();
    return;
  }
  if (visit.gauge >= 100) {
    settle(true);
    return;
  }

  state.heartTimer -= dt;
  if (!realTell && state.heartTimer <= 0) {
    spawnHeart();
    state.heartTimer = 0.55 - 0.4 * clamp(visit.gauge / 100, 0, 1);
  }
}

function enterRush() {
  state.rush = true;
  elements.machine.classList.add("is-rush");
  audio.rush();
  spawnFloater(`ラストスパート! ${formatMultiplier(RUSH_MULT)}`, "is-banner", elements.pad.clientWidth / 2, 62);
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

  if (!state.rush && state.timeLeft <= RUSH_AT && state.timeLeft > 0) enterRush();
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
    score: 0, petted: 0, combo: 0, bestCombo: 0, perfect: 0, huff: 0,
    visits: 0, shinies: 0, rush: false,
    visit: null, lastCatId: "",
  });
  lastHint = "";
  elements.floaters.replaceChildren();
  elements.machine.classList.remove("is-rush");
  elements.machine.classList.add("is-playing");
  setStatus("猫を長押しでなでます。「!」が出たら、ぷいっの前に離して。");
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
  if ((state.phase === "petting" || state.phase === "tell") && state.visit.gauge >= POKE_MAX) settle(false);
  audio.purrStop();
  render();
  elements.machine.classList.remove("is-playing", "is-rush");
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
  elements.resultPetted.textContent = state.petted;
  elements.resultScore.textContent = state.score.toLocaleString("ja-JP");
  elements.resultCombo.textContent = state.bestCombo;
  elements.resultPerfect.textContent = state.perfect;
  elements.resultHuff.textContent = state.huff;
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
  context.fillText(`${state.petted}匹`, 98, 283);
  context.fillStyle = "#30281f";
  context.font = '800 34px "M PLUS Rounded 1c", "Hiragino Sans", sans-serif';
  context.fillText("をなでました。", 104, 338);

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
  context.fillText(`最大コンボ ${state.bestCombo}　パーフェクト ${state.perfect}回`, 104, 484);
  context.fillText(`ぷいっ ${state.huff}回`, 104, 512);
  context.fillStyle = "#a86c49";
  context.font = '700 18px "Zen Kaku Gothic New", "Hiragino Sans", sans-serif';
  context.fillText("#ごろごろ限界 #グローバルキャットデー", 104, 550);

  return canvasToFile(canvas, "gorogoro-result.png");
}

function resultShareText(includeUrl = false) {
  let text =
    `ごろごろ限界で${state.petted}匹をなでて、${state.score.toLocaleString("ja-JP")}点。「${state.rank}」\n` +
    `最大コンボ ${state.bestCombo} / パーフェクト ${state.perfect}回 / ぷいっ ${state.huff}回`;
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
