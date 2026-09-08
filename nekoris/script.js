(() => {
  "use strict";

  const STORAGE_KEY = "nekoris:unlocked-stage";
  const SOUND_KEY = "nekoris:sound";
  const CAT_ASSETS = {
    square: "./assets/cat-pose-square.png",
    long: "./assets/cat-pose-long.png",
    choko: "./assets/cat-pose-choko.png",
    nobi: "./assets/cat-pose-nobi.png",
    vertical: "./assets/cat-pose-vertical.png",
    corner: "./assets/cat-pose-corner.png",
    tee: "./assets/cat-pose-tee.png",
    zig: "./assets/cat-pose-zig.png",
    ell: "./assets/cat-pose-ell.png",
    plus: "./assets/cat-pose-plus.png",
    cup: "./assets/cat-pose-cup.png",
    stair: "./assets/cat-pose-stair.png",
  };
  const SHAPES = {
    square: [[0,0],[1,0],[0,1],[1,1]],
    domino: [[0,0],[1,0]],
    long3: [[0,0],[1,0],[2,0]],
    long4: [[0,0],[1,0],[2,0],[3,0]],
    corner3: [[0,0],[1,0],[1,1]],
    tee4: [[0,0],[1,0],[2,0],[1,1]],
    zig4: [[0,0],[1,0],[1,1],[2,1]],
    ell4: [[0,0],[0,1],[0,2],[1,2]],
    plus5: [[1,0],[0,1],[1,1],[2,1],[1,2]],
    cup5: [[0,0],[2,0],[0,1],[1,1],[2,1]],
    stair5: [[0,0],[1,0],[1,1],[2,1],[2,2]],
  };

  const LEVEL_DESIGNS = [
    {
      name: "はじめての箱",
      copy: "ちいさな箱から、ためしてみよう。",
      cols: 4, rows: 3,
      pieces: [
        piece("maru", "まるまり", "square", 1, 0, 0, 0),
        piece("suya", "すやすや", "domino", 2, 2, 0, 1, { pose: "long" }),
        piece("choko", "ちょこん", "domino", 0, 3, 0, 1, { pose: "choko" }),
        piece("nobi", "のびーる", "long4", 4, 0, 2, 0, { pose: "nobi" }),
      ],
    },
    {
      name: "はみだし注意",
      copy: "箱の輪郭を見て、向きをひとつずつ。",
      cols: 5, rows: 4,
      pieces: [
        piece("s2-maru", "まるまり", "square", 1, 0, 0, 0),
        piece("s2-suya", "すやすや", "long3", 2, 2, 1, 0, { pose: "long" }),
        piece("s2-banzai", "ばんざい", "tee4", 3, 2, 2, 0),
        piece("s2-kururi", "くるり", "corner3", 4, 0, 2, 3),
        piece("s2-choko", "ちょこん", "domino", 0, 2, 0, 0, { pose: "choko" }),
      ],
    },
    {
      name: "でこぼこの道",
      copy: "細い道を先に読むと、猫がするり。",
      cols: 6, rows: 5,
      pieces: [
        piece("s3-stand-a", "たてなが", "long4", 0, 2, 0, 1, { pose: "vertical", initialRotation: 1 }),
        piece("s3-zig", "くねくね", "zig4", 1, 3, 0, 0, { pose: "tee" }),
        piece("s3-banzai", "ばんざい", "tee4", 2, 3, 1, 3),
        piece("s3-kururi", "くるり", "corner3", 4, 0, 3, 0),
        piece("s3-stand-b", "のっぽ", "long3", 0, 1, 0, 1, { pose: "vertical", initialRotation: 1 }),
      ],
    },
    {
      name: "ジグザグの箱",
      copy: "長い猫を置く順番が、分かれ道。",
      cols: 6, rows: 4,
      pieces: [
        piece("s4-nobi", "のびーる", "long4", 4, 0, 0, 0, { pose: "nobi" }),
        piece("s4-zig", "くねくね", "zig4", 1, 1, 2, 0, { pose: "tee" }),
        piece("s4-ell", "すみっこ", "ell4", 3, 4, 1, 0, { pose: "corner" }),
        piece("s4-suya", "すやすや", "long3", 2, 0, 1, 0, { pose: "long" }),
        piece("s4-choko", "ちょこん", "domino", 0, 3, 1, 1, { pose: "choko" }),
      ],
    },
    {
      name: "真ん中の鍵",
      copy: "十字の猫を、どこに寝かせる？",
      cols: 6, rows: 5,
      pieces: [
        piece("s5-cross", "だいのじ", "plus5", 1, 2, 2, 0, { pose: "square" }),
        piece("s5-zig", "くねくね", "zig4", 2, 3, 1, 0, { pose: "tee" }),
        piece("s5-ell", "すみっこ", "ell4", 3, 0, 1, 0, { pose: "corner" }),
        piece("s5-banzai", "ばんざい", "tee4", 4, 1, 0, 0),
        piece("s5-kururi", "くるり", "corner3", 5, 1, 1, 2),
      ],
    },
    {
      name: "たてよこ交差",
      copy: "同じ長さでも、向きが違えば別の鍵。",
      cols: 6, rows: 5,
      pieces: [
        piece("s6-stand-a", "たてなが", "long4", 0, 3, 0, 1, { pose: "vertical", initialRotation: 1 }),
        piece("s6-zig", "くねくね", "zig4", 1, 0, 2, 0, { pose: "tee" }),
        piece("s6-stand-b", "のっぽ", "long3", 0, 2, 0, 1, { pose: "vertical", initialRotation: 1 }),
        piece("s6-banzai", "ばんざい", "tee4", 2, 4, 1, 3),
        piece("s6-ell", "すみっこ", "ell4", 3, 3, 3, 3, { pose: "corner" }),
        piece("s6-choko", "ちょこん", "domino", 4, 1, 0, 1, { pose: "choko" }),
      ],
    },
    {
      name: "コの字の寝床",
      copy: "くぼみに入る猫は、一匹だけ。",
      cols: 6, rows: 5,
      pieces: [
        piece("s7-cross", "だいのじ", "plus5", 1, 3, 1, 0, { pose: "square" }),
        piece("s7-nobi", "のびーる", "long4", 4, 1, 4, 0, { pose: "nobi" }),
        piece("s7-zig", "くねくね", "zig4", 2, 1, 2, 0, { pose: "tee" }),
        piece("s7-cup", "すっぽり", "cup5", 3, 1, 0, 0, { pose: "tee" }),
        piece("s7-ell", "すみっこ", "ell4", 0, 0, 1, 0, { pose: "corner" }),
      ],
    },
    {
      name: "一マスの首",
      copy: "細い入口の奥へ、先に届けよう。",
      cols: 6, rows: 6,
      pieces: [
        piece("s8-cross", "だいのじ", "plus5", 1, 3, 2, 0, { pose: "square" }),
        piece("s8-zig", "くねくね", "zig4", 2, 2, 1, 1, { pose: "tee" }),
        piece("s8-banzai", "ばんざい", "tee4", 3, 0, 2, 1),
        piece("s8-suya", "すやすや", "long3", 4, 1, 5, 0, { pose: "long" }),
        piece("s8-ell", "すみっこ", "ell4", 0, 0, 0, 3, { pose: "corner" }),
        piece("s8-choko", "ちょこん", "domino", 5, 2, 4, 0, { pose: "choko" }),
      ],
    },
    {
      name: "うらおもて",
      copy: "似たくぼみを見分ける、二段構え。",
      cols: 7, rows: 6,
      pieces: [
        piece("s9-cross", "だいのじ", "plus5", 1, 4, 0, 0, { pose: "square" }),
        piece("s9-nobi", "のびーる", "long4", 4, 1, 4, 0, { pose: "nobi" }),
        piece("s9-zig", "くねくね", "zig4", 2, 3, 2, 0, { pose: "tee" }),
        piece("s9-cup", "すっぽり", "cup5", 3, 2, 1, 1, { pose: "tee" }),
        piece("s9-ell", "すみっこ", "ell4", 0, 0, 1, 2, { pose: "corner" }),
        piece("s9-suya", "すやすや", "long3", 5, 2, 5, 0, { pose: "long" }),
      ],
    },
    {
      name: "猫は液体",
      copy: "6つの寝相。最後の一手までよく見て。",
      cols: 7, rows: 6,
      pieces: [
        piece("s10-cross", "だいのじ", "plus5", 1, 0, 0, 0, { pose: "square" }),
        piece("s10-zig", "くねくね", "zig4", 2, 2, 2, 0, { pose: "tee" }),
        piece("s10-cup", "すっぽり", "cup5", 3, 3, 0, 2, { pose: "tee" }),
        piece("s10-stair", "かいだん", "stair5", 4, 4, 1, 2, { pose: "corner" }),
        piece("s10-banzai", "ばんざい", "tee4", 5, 3, 4, 0),
        piece("s10-ell", "すみっこ", "ell4", 0, 2, 3, 0, { pose: "corner" }),
      ],
    },
  ];

  // 少ないピース数のまま、候補配置と先読みの枝分かれが増える順に並べる。
  const LEVELS = [0, 3, 6, 1, 4, 2, 7, 8, 5, 9].map((index) => LEVEL_DESIGNS[index]);

  function piece(id, name, shape, art, x, y, rotation, options = {}) {
    return {
      id, name, shapeName: shape, shape: SHAPES[shape], art,
      pose: options.pose || null,
      initialRotation: options.initialRotation || 0,
      solution: { x, y, rotation },
    };
  }

  const el = {
    board: document.querySelector("#board"), targetGrid: document.querySelector("#targetGrid"),
    placedLayer: document.querySelector("#placedLayer"), preview: document.querySelector("#placementPreview"),
    tray: document.querySelector("#catTray"), rotate: document.querySelector("#rotateButton"),
    selectedName: document.querySelector("#selectedName"), selectedSize: document.querySelector("#selectedSize"),
    catCount: document.querySelector("#catCount"), stageNumber: document.querySelector("#stageNumber"),
    stageTotal: document.querySelector("#stageTotal"),
    stageCopy: document.querySelector("#stageCopy"), fillValue: document.querySelector("#fillValue"),
    fillBar: document.querySelector("#fillBar"), hint: document.querySelector("#hintButton"),
    reset: document.querySelector("#resetButton"), rulesButton: document.querySelector("#rulesButton"),
    soundButton: document.querySelector("#soundButton"),
    rulesDialog: document.querySelector("#rulesDialog"), clearDialog: document.querySelector("#clearDialog"),
    clearStage: document.querySelector("#clearStage"), clearMessage: document.querySelector("#clearMessage"),
    share: document.querySelector("#shareButton"), next: document.querySelector("#nextButton"),
    replay: document.querySelector("#replayButton"), toast: document.querySelector("#toast"),
  };

  let levelIndex = 0;
  let selectedId = null;
  let rotations = new Map();
  let placements = new Map();
  const poseImages = new Map();
  const poseSprites = new Map();
  let target = new Set();
  let drag = null;
  let toastTimer = 0;
  let keyboardCell = { x: 0, y: 0 };
  let soundEnabled = true;
  let audioContext = null;

  try { soundEnabled = localStorage.getItem(SOUND_KEY) !== "off"; } catch {}

  function playTone(frequency, duration, delay = 0, endFrequency = frequency, type = "sine", volume = .035) {
    if (!soundEnabled) return;
    const AudioEngine = window.AudioContext || window.webkitAudioContext;
    if (!AudioEngine) return;
    audioContext ||= new AudioEngine();
    if (audioContext.state === "suspended") audioContext.resume();
    const start = audioContext.currentTime + delay;
    const oscillator = audioContext.createOscillator();
    const gain = audioContext.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, start);
    oscillator.frequency.exponentialRampToValueAtTime(Math.max(1, endFrequency), start + duration);
    gain.gain.setValueAtTime(.0001, start);
    gain.gain.exponentialRampToValueAtTime(volume, start + .012);
    gain.gain.exponentialRampToValueAtTime(.0001, start + duration);
    oscillator.connect(gain).connect(audioContext.destination);
    oscillator.start(start); oscillator.stop(start + duration + .02);
  }

  function playSound(name) {
    if (name === "select") playTone(520, .055, 0, 610, "triangle", .026);
    if (name === "rotate") playTone(350, .095, 0, 690, "sine", .032);
    if (name === "place") { playTone(260, .11, 0, 150, "sine", .045); playTone(520, .055, .025, 460, "triangle", .018); }
    if (name === "back") playTone(360, .09, 0, 220, "triangle", .028);
    if (name === "error") playTone(115, .12, 0, 92, "square", .014);
    if (name === "hint") { playTone(660, .08, 0, 760, "sine", .025); playTone(880, .11, .075, 990, "sine", .022); }
    if (name === "clear") [523,659,784,1047].forEach((note,index) => playTone(note, .2, index * .095, note * 1.01, "triangle", .027));
  }

  function updateSoundButton() {
    el.soundButton.setAttribute("aria-pressed", String(!soundEnabled));
    el.soundButton.setAttribute("aria-label", soundEnabled ? "効果音を切る" : "効果音を入れる");
    el.soundButton.textContent = soundEnabled ? "♪ 音あり" : "♩ 音なし";
  }

  function toggleSound() {
    soundEnabled = !soundEnabled;
    try { localStorage.setItem(SOUND_KEY, soundEnabled ? "on" : "off"); } catch {}
    updateSoundButton();
    if (soundEnabled) playSound("select");
  }

  function rotatedCells(shape, turns) {
    let cells = shape.map(([x,y]) => [x,y]);
    for (let i = 0; i < ((turns % 4) + 4) % 4; i += 1) cells = cells.map(([x,y]) => [-y,x]);
    const minX = Math.min(...cells.map(([x]) => x));
    const minY = Math.min(...cells.map(([,y]) => y));
    return cells.map(([x,y]) => [x - minX, y - minY]).sort((a,b) => a[1] - b[1] || a[0] - b[0]);
  }

  function bounds(cells) {
    return { w: Math.max(...cells.map(([x]) => x)) + 1, h: Math.max(...cells.map(([,y]) => y)) + 1 };
  }

  function key(x, y) { return `${x},${y}`; }

  function buildTarget(level) {
    const cells = new Set();
    level.pieces.forEach((item) => {
      rotatedCells(item.shape, item.solution.rotation).forEach(([x,y]) => cells.add(key(item.solution.x + x, item.solution.y + y)));
    });
    return cells;
  }

  function loadImage(src) {
    return new Promise((resolve, reject) => {
      const image = new Image(); image.decoding = "async";
      image.onload = () => resolve(image); image.onerror = reject; image.src = src;
    });
  }

  async function prepareArt() {
    try {
      const entries = await Promise.all(Object.entries(CAT_ASSETS).map(async ([name, src]) => [name, await loadImage(src)]));
      for (const [name, source] of entries) {
        const cleanedUrl = cleanTransparentAsset(source);
        poseImages.set(name, await loadImage(cleanedUrl));
      }
      poseSprites.clear();
      renderTray(); renderPlaced();
    } catch { showToast("猫の絵を読み込めませんでした"); }
  }

  function cleanTransparentAsset(source) {
    const canvas = document.createElement("canvas"); canvas.width = source.width; canvas.height = source.height;
    const context = canvas.getContext("2d", { willReadFrequently: true });
    context.drawImage(source, 0, 0);
    const imageData = context.getImageData(0, 0, canvas.width, canvas.height); const { data } = imageData;
    let minX = canvas.width, minY = canvas.height, maxX = 0, maxY = 0;
    for (let y = 0; y < canvas.height; y += 1) for (let x = 0; x < canvas.width; x += 1) {
      const offset = (y * canvas.width + x) * 4; const alpha = data[offset + 3];
      if (alpha < 172) data[offset + 3] = 0;
      else data[offset + 3] = Math.min(255, Math.round((alpha - 172) * 3.1));
      if (data[offset + 3] > 20) { minX = Math.min(minX,x); minY = Math.min(minY,y); maxX = Math.max(maxX,x); maxY = Math.max(maxY,y); }
    }
    context.putImageData(imageData, 0, 0);
    const pad = Math.round(Math.min(canvas.width, canvas.height) * .035);
    const sx = Math.max(0, minX - pad), sy = Math.max(0, minY - pad);
    const sw = Math.min(canvas.width - sx, maxX - minX + pad * 2 + 1), sh = Math.min(canvas.height - sy, maxY - minY + pad * 2 + 1);
    const cropped = document.createElement("canvas"); cropped.width = sw; cropped.height = sh;
    cropped.getContext("2d").drawImage(canvas, sx, sy, sw, sh, 0, 0, sw, sh);
    return cropped.toDataURL("image/png");
  }

  function poseFor(item, rotation) {
    const turns = ((rotation % 4) + 4) % 4;
    const shapePose = { zig4: "zig", ell4: "ell", plus5: "plus", cup5: "cup", stair5: "stair" }[item.shapeName];
    if (shapePose) return { name: shapePose, turns };
    if (item.pose === "vertical") return { name: "vertical", turns: (turns + 3) % 4 };
    if (item.pose) return { name: item.pose, turns };
    if (item.shapeName === "square") return { name: "square", turns: 0 };
    if (item.shapeName === "corner3") return { name: "corner", turns };
    if (item.shapeName === "tee4") return { name: "tee", turns };
    return { name: "long", turns };
  }

  function catSprite(item, rotation) {
    const pose = poseFor(item, rotation); const cacheKey = `${pose.name}:${pose.turns}`;
    if (poseSprites.has(cacheKey)) return poseSprites.get(cacheKey);
    const source = poseImages.get(pose.name); if (!source) return "";
    const turns = pose.turns;
    const canvas = document.createElement("canvas");
    canvas.width = turns % 2 ? source.height : source.width;
    canvas.height = turns % 2 ? source.width : source.height;
    const context = canvas.getContext("2d");
    context.translate(canvas.width / 2, canvas.height / 2);
    context.rotate(turns * Math.PI / 2);
    context.drawImage(source, -source.width / 2, -source.height / 2);
    const url = canvas.toDataURL("image/png"); poseSprites.set(cacheKey,url); return url;
  }

  function pieceMarkup(item, rotation) {
    const cells = rotatedCells(item.shape, rotation); const size = bounds(cells);
    const pose = poseFor(item, rotation);
    const sprite = catSprite(item, rotation);
    const src = sprite || CAT_ASSETS[pose.name];
    const fallbackRotation = !sprite && pose.turns ? ` style="transform:rotate(${pose.turns * 90}deg)"` : "";
    return `<div class="piece-visual" data-span="${Math.max(size.w,size.h)}" style="width:calc(var(--tile) * ${size.w});height:calc(var(--tile) * ${size.h})" aria-hidden="true"><img class="jelly-cat" src="${src}" alt="" draggable="false" decoding="async"${fallbackRotation} /></div>`;
  }

  function loadLevel(index) {
    levelIndex = Math.max(0, Math.min(index, LEVELS.length - 1));
    selectedId = null; rotations = new Map(); placements = new Map();
    keyboardCell = { x: 0, y: 0 };
    const level = LEVELS[levelIndex]; level.pieces.forEach((item) => rotations.set(item.id, item.initialRotation));
    target = buildTarget(level);
    el.board.style.setProperty("--cols", level.cols); el.board.style.setProperty("--rows", level.rows);
    el.stageNumber.textContent = String(levelIndex + 1); el.stageTotal.textContent = String(LEVELS.length); el.stageCopy.textContent = level.copy;
    renderTarget(); renderTray(); renderPlaced(); updateStatus(); hidePreview();
  }

  function renderTarget() {
    const level = LEVELS[levelIndex]; el.targetGrid.replaceChildren();
    for (let y = 0; y < level.rows; y += 1) for (let x = 0; x < level.cols; x += 1) {
      const cellKey = key(x,y);
      const cell = document.createElement("div");
      cell.className = `target-cell${target.has(cellKey) ? "" : " is-void"}${occupiedCells().has(cellKey) ? " is-filled" : ""}`;
      cell.setAttribute("role", "gridcell"); el.targetGrid.append(cell);
    }
  }

  function renderTray() {
    const level = LEVELS[levelIndex]; el.tray.replaceChildren();
    level.pieces.forEach((item) => {
      const card = document.createElement("button"); card.type = "button";
      card.className = `cat-card${selectedId === item.id ? " is-selected" : ""}${placements.has(item.id) ? " is-placed" : ""}`;
      card.dataset.id = item.id; card.setAttribute("aria-pressed", selectedId === item.id ? "true" : "false");
      card.innerHTML = `<span class="cat-card-name">${item.name}</span>${pieceMarkup(item, rotations.get(item.id) || 0)}`;
      card.addEventListener("pointerdown", onPiecePointerDown); card.addEventListener("click", () => selectPiece(item.id));
      el.tray.append(card);
    });
  }

  function renderPlaced(squishId = null) {
    const level = LEVELS[levelIndex]; renderTarget(); el.placedLayer.replaceChildren();
    placements.forEach((placement, id) => {
      const item = level.pieces.find((entry) => entry.id === id); const cells = rotatedCells(item.shape, placement.rotation); const size = bounds(cells);
      const node = document.createElement("button"); node.type = "button"; node.className = `placed-piece${id === squishId ? " is-squishing" : ""}`;
      node.style.left = `${placement.x / level.cols * 100}%`; node.style.top = `${placement.y / level.rows * 100}%`;
      node.style.width = `${size.w / level.cols * 100}%`; node.style.height = `${size.h / level.rows * 100}%`;
      node.setAttribute("aria-label", `${item.name}を箱から戻す`);
      const sprite = catSprite(item, placement.rotation);
      if (sprite) {
        const image = document.createElement("img"); image.className = "jelly-cat"; image.src = sprite; image.alt = ""; image.draggable = false;
        node.append(image);
      }
      node.addEventListener("click", (event) => {
        const cell = boardCellFromPoint(event.clientX, event.clientY);
        const ownCells = new Set(cells.map(([dx,dy]) => key(placement.x + dx, placement.y + dy)));
        if (selectedId && !ownCells.has(key(cell.x, cell.y))) placeSelected(cell.x, cell.y);
        else returnPiece(id);
      });
      el.placedLayer.append(node);
    });
  }

  function selectPiece(id) {
    if (placements.has(id)) return;
    selectedId = selectedId === id ? null : id; renderTray(); updateSelected(); hidePreview();
    if (selectedId) playSound("select");
  }

  function updateSelected() {
    const item = LEVELS[levelIndex].pieces.find((entry) => entry.id === selectedId);
    el.rotate.disabled = !item;
    el.selectedName.textContent = item ? item.name : "猫を選んでね";
    el.selectedSize.textContent = item ? `${item.shape.length} ブロック分` : "—";
  }

  function rotateSelected() {
    if (!selectedId) return;
    rotations.set(selectedId, ((rotations.get(selectedId) || 0) + 1) % 4); renderTray(); updateSelected();
    playSound("rotate");
  }

  function occupiedCells(ignoreId = null) {
    const level = LEVELS[levelIndex]; const used = new Set();
    placements.forEach((placement,id) => {
      if (id === ignoreId) return;
      const item = level.pieces.find((entry) => entry.id === id);
      rotatedCells(item.shape, placement.rotation).forEach(([x,y]) => used.add(key(placement.x+x, placement.y+y)));
    });
    return used;
  }

  function canPlace(item, x, y, rotation) {
    const used = occupiedCells(item.id);
    return rotatedCells(item.shape, rotation).every(([dx,dy]) => target.has(key(x+dx,y+dy)) && !used.has(key(x+dx,y+dy)));
  }

  function placeSelected(x, y) {
    if (!selectedId) { playSound("error"); showToast("先に、待っている猫を選んでね"); return; }
    const item = LEVELS[levelIndex].pieces.find((entry) => entry.id === selectedId); const rotation = rotations.get(selectedId) || 0;
    if (!canPlace(item,x,y,rotation)) { playSound("error"); showToast("そこには入りきらないみたい"); return; }
    const placedId = selectedId; placements.set(placedId,{x,y,rotation}); selectedId = null;
    renderTray(); renderPlaced(placedId); updateSelected(); updateStatus(); hidePreview();
    playSound("place");
    if (totalFilled() === target.size) window.setTimeout(showClear, 480);
  }

  function returnPiece(id) {
    placements.delete(id); selectedId = id; rotations.set(id, rotations.get(id) || 0);
    renderTray(); renderPlaced(); updateSelected(); updateStatus(); showToast("箱から、そっと戻しました");
    playSound("back");
  }

  function totalFilled() {
    const level = LEVELS[levelIndex];
    return [...placements.keys()].reduce((sum,id) => sum + level.pieces.find((item) => item.id === id).shape.length, 0);
  }

  function updateStatus() {
    const level = LEVELS[levelIndex];
    const filled = totalFilled();
    const percent = Math.round(filled / target.size * 100); el.fillValue.textContent = `${percent}%`; el.fillBar.style.width = `${percent}%`;
    el.catCount.textContent = `${level.pieces.length - placements.size}匹`;
  }

  function boardCellFromPoint(clientX, clientY) {
    const rect = el.board.getBoundingClientRect(); const level = LEVELS[levelIndex];
    return { x: Math.floor((clientX - rect.left) / rect.width * level.cols), y: Math.floor((clientY - rect.top) / rect.height * level.rows) };
  }

  function showPreview(x,y) {
    if (!selectedId) return hidePreview();
    const level = LEVELS[levelIndex]; const item = level.pieces.find((entry) => entry.id === selectedId); const rotation = rotations.get(selectedId) || 0;
    const cells = rotatedCells(item.shape,rotation); const valid = canPlace(item,x,y,rotation);
    el.preview.hidden = false; el.preview.classList.toggle("is-invalid", !valid); el.preview.replaceChildren();
    cells.forEach(([dx,dy]) => { const node = document.createElement("i"); node.className = "preview-cell"; node.style.left = `${(x+dx)/level.cols*100}%`; node.style.top = `${(y+dy)/level.rows*100}%`; node.style.width = `${1/level.cols*100}%`; node.style.height = `${1/level.rows*100}%`; el.preview.append(node); });
  }
  function hidePreview() { el.preview.hidden = true; el.preview.replaceChildren(); }

  function onPiecePointerDown(event) {
    if (event.button !== 0 && event.pointerType === "mouse") return;
    const id = event.currentTarget.dataset.id;
    const item = LEVELS[levelIndex].pieces.find((entry) => entry.id === id);
    drag = { id, startX: event.clientX, startY: event.clientY, moved: false, ghost: null, item };
    window.addEventListener("pointermove", onDragMove); window.addEventListener("pointerup", onDragEnd, { once: true });
  }

  function onDragMove(event) {
    if (!drag) return;
    if (!drag.moved && Math.hypot(event.clientX-drag.startX,event.clientY-drag.startY) < 7) return;
    drag.moved = true;
    if (selectedId !== drag.id) selectPiece(drag.id);
    if (!drag.ghost) { drag.ghost = document.createElement("div"); drag.ghost.className = "drag-ghost"; drag.ghost.innerHTML = pieceMarkup(drag.item, rotations.get(drag.id) || 0); document.body.append(drag.ghost); }
    drag.ghost.style.left = `${event.clientX}px`; drag.ghost.style.top = `${event.clientY}px`;
    const rect = el.board.getBoundingClientRect();
    if (event.clientX >= rect.left && event.clientX <= rect.right && event.clientY >= rect.top && event.clientY <= rect.bottom) { const cell = boardCellFromPoint(event.clientX,event.clientY); showPreview(cell.x,cell.y); } else hidePreview();
  }

  function onDragEnd(event) {
    window.removeEventListener("pointermove", onDragMove);
    if (!drag) return; const wasMoved = drag.moved; drag.ghost?.remove();
    if (wasMoved) { const rect = el.board.getBoundingClientRect(); if (event.clientX >= rect.left && event.clientX <= rect.right && event.clientY >= rect.top && event.clientY <= rect.bottom) { const cell = boardCellFromPoint(event.clientX,event.clientY); placeSelected(cell.x,cell.y); } }
    drag = null; hidePreview();
  }

  function giveHint() {
    const level = LEVELS[levelIndex]; const item = level.pieces.find((entry) => !placements.has(entry.id));
    if (!item) return;
    selectedId = item.id; rotations.set(item.id,item.solution.rotation); renderTray(); updateSelected(); showPreview(item.solution.x,item.solution.y);
    el.board.classList.remove("hint-flash"); void el.board.offsetWidth; el.board.classList.add("hint-flash");
    playSound("hint");
    showToast(`${item.name}の居場所が光っています`); window.setTimeout(hidePreview,1900);
  }

  function showClear() {
    const last = levelIndex === LEVELS.length - 1;
    const stageNumber = levelIndex + 1;
    const shareText = `ネコリス STAGE ${stageNumber} クリア！\n猫は液体。すきまなく、ぴたっ。\n#ネコリス`;
    const shareUrl = `${window.location.origin}${window.location.pathname}?card=nekoris-game-v3`;
    playSound("clear");
    el.clearStage.textContent = `STAGE ${stageNumber} CLEAR!`;
    el.clearMessage.textContent = last ? "ぜんぶの猫が、居心地のいい場所を見つけました。" : "猫たちは、すっかり落ち着いたようです。";
    el.share.href = `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(shareUrl)}`;
    el.share.setAttribute("aria-label", `ステージ${stageNumber}のクリア結果をXで共有`);
    el.next.textContent = last ? "最初の箱へ" : "つぎの箱へ";
    try { localStorage.setItem(STORAGE_KEY, String(Math.min(LEVELS.length, levelIndex + 2))); } catch {}
    el.clearDialog.showModal();
  }

  function showToast(message) { window.clearTimeout(toastTimer); el.toast.textContent = message; el.toast.classList.add("is-visible"); toastTimer = window.setTimeout(() => el.toast.classList.remove("is-visible"),1800); }

  el.board.addEventListener("click", (event) => { if (event.target.closest(".placed-piece")) return; const cell = boardCellFromPoint(event.clientX,event.clientY); placeSelected(cell.x,cell.y); });
  el.board.addEventListener("pointermove", (event) => { if (!drag) { const cell = boardCellFromPoint(event.clientX,event.clientY); showPreview(cell.x,cell.y); } });
  el.board.addEventListener("pointerleave", () => { if (!drag) hidePreview(); });
  el.board.addEventListener("focus", () => { if (selectedId) showPreview(keyboardCell.x, keyboardCell.y); });
  el.board.addEventListener("keydown", (event) => {
    const level = LEVELS[levelIndex];
    if (["ArrowLeft","ArrowRight","ArrowUp","ArrowDown","Enter"," "].includes(event.key)) event.preventDefault();
    if (event.key === "ArrowLeft") keyboardCell.x = Math.max(0, keyboardCell.x - 1);
    if (event.key === "ArrowRight") keyboardCell.x = Math.min(level.cols - 1, keyboardCell.x + 1);
    if (event.key === "ArrowUp") keyboardCell.y = Math.max(0, keyboardCell.y - 1);
    if (event.key === "ArrowDown") keyboardCell.y = Math.min(level.rows - 1, keyboardCell.y + 1);
    if (["ArrowLeft","ArrowRight","ArrowUp","ArrowDown"].includes(event.key)) showPreview(keyboardCell.x, keyboardCell.y);
    if (event.key === "Enter" || event.key === " ") placeSelected(keyboardCell.x, keyboardCell.y);
  });
  el.rotate.addEventListener("click", rotateSelected); el.hint.addEventListener("click", giveHint);
  el.soundButton.addEventListener("click", toggleSound);
  el.reset.addEventListener("click", () => loadLevel(levelIndex));
  el.rulesButton.addEventListener("click", () => el.rulesDialog.showModal());
  document.querySelectorAll("[data-close-dialog]").forEach((button) => button.addEventListener("click", () => el.rulesDialog.close()));
  el.next.addEventListener("click", () => { el.clearDialog.close(); loadLevel((levelIndex + 1) % LEVELS.length); });
  el.replay.addEventListener("click", () => { el.clearDialog.close(); loadLevel(levelIndex); });
  window.addEventListener("keydown", (event) => { if (event.key.toLowerCase() === "r" && !el.rulesDialog.open && !el.clearDialog.open) rotateSelected(); if (event.key === "Escape") hidePreview(); });

  updateSoundButton(); loadLevel(0); updateSelected(); prepareArt();
})();
