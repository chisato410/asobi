(() => {
  "use strict";

  const { Engine, Runner, Bodies, Body, Composite, Constraint, Events } = Matter;
  const STORAGE_KEY = "nekomori:best-score";
  const CAT_NAMES = ["しまねこ", "まるねこ", "しろふわ", "みけねこ", "のびねこ", "デカネコ"];
  const CAT_SPECS = [
    { w: 68, h: 88, art: 103, chamfer: 24, score: 8 },
    { w: 104, h: 60, art: 112, chamfer: 26, score: 22 },
    { w: 124, h: 55, art: 132, chamfer: 26, score: 54 },
    { w: 126, h: 76, art: 140, chamfer: 32, score: 120 },
    { w: 144, h: 72, art: 164, chamfer: 30, score: 260 },
    { w: 124, h: 150, art: 166, chamfer: 52, score: 600 },
  ];
  const SPAWN_POOL = [0, 0, 0, 0, 1, 1, 1, 2];
  const GAME_CAT_SCALE = 0.85;
  const MAX_TILT = 0.48;
  const CAT_SOURCE = "./assets/cat-source.png";
  const CAT_CROPS = [
    { x: 104, y: 92, w: 286, h: 366 },
    { x: 516, y: 184, w: 392, h: 286 },
    { x: 970, y: 218, w: 542, h: 260 },
    { x: 58, y: 616, w: 418, h: 326 },
    { x: 468, y: 520, w: 508, h: 424 },
    { x: 1020, y: 506, w: 466, h: 470 },
  ];

  const el = {
    playfield: document.querySelector("#playfield"),
    catLayer: document.querySelector("#catLayer"),
    plate: document.querySelector("#plate"),
    guide: document.querySelector("#dropGuide"),
    guideCat: document.querySelector("#dropGuide .guide-cat"),
    startOverlay: document.querySelector("#startOverlay"),
    resultOverlay: document.querySelector("#resultOverlay"),
    startButton: document.querySelector("#startButton"),
    retryButton: document.querySelector("#retryButton"),
    dropButton: document.querySelector("#dropButton"),
    mobileDropButton: document.querySelector("#mobileDropButton"),
    score: document.querySelector("#scoreValue"),
    best: document.querySelector("#bestValue"),
    resultScore: document.querySelector("#resultScore"),
    resultMessage: document.querySelector("#resultMessage"),
    nextCat: document.querySelector("#nextCat"),
    catName: document.querySelector("#catName"),
    tiltNeedle: document.querySelector("#tiltNeedle"),
    tiltLabel: document.querySelector("#tiltLabel"),
    soundButton: document.querySelector("#soundButton"),
    soundLabel: document.querySelector("#soundButton .sound-label"),
    effectsCanvas: document.querySelector("#effectsCanvas"),
    evolutionCells: [...document.querySelectorAll("[data-merge-level]")],
  };

  let engine;
  let runner;
  let plateBody;
  let plateConstraint;
  let state = "idle";
  let bodies = new Set();
  let score = 0;
  let best = readBest();
  let nextLevel = randomSpawnLevel();
  let aimX = 0;
  let canDrop = false;
  let soundOn = true;
  let tiltStartedAt = 0;
  let animationId = 0;
  let particles = [];
  let lastFrameAt = performance.now();

  const ctx = el.effectsCanvas.getContext("2d");

  function readBest() {
    try {
      const value = Number(localStorage.getItem(STORAGE_KEY));
      return Number.isFinite(value) && value > 0 ? value : 0;
    } catch {
      return 0;
    }
  }

  function saveBest() {
    if (score <= best) return;
    best = score;
    try { localStorage.setItem(STORAGE_KEY, String(best)); } catch { /* local play still works */ }
  }

  function randomSpawnLevel() {
    return SPAWN_POOL[Math.floor(Math.random() * SPAWN_POOL.length)];
  }

  function loadImage(src) {
    return new Promise((resolve, reject) => {
      const image = new Image();
      image.decoding = "async";
      image.onload = () => resolve(image);
      image.onerror = reject;
      image.src = src;
    });
  }

  function isConnectedBackground(data, offset) {
    const red = data[offset];
    const green = data[offset + 1];
    const blue = data[offset + 2];
    const alpha = data[offset + 3];
    const darkest = Math.min(red, green, blue);
    const lightest = Math.max(red, green, blue);
    return alpha === 0 || (darkest > 218 && lightest - darkest < 34);
  }

  function extractTransparentCat(source, crop) {
    const canvas = document.createElement("canvas");
    canvas.width = crop.w;
    canvas.height = crop.h;
    const context = canvas.getContext("2d", { willReadFrequently: true });
    context.drawImage(source, crop.x, crop.y, crop.w, crop.h, 0, 0, crop.w, crop.h);

    const imageData = context.getImageData(0, 0, crop.w, crop.h);
    const { data } = imageData;
    const visited = new Uint8Array(crop.w * crop.h);
    const queue = new Int32Array(crop.w * crop.h);
    let head = 0;
    let tail = 0;

    function enqueue(x, y) {
      if (x < 0 || y < 0 || x >= crop.w || y >= crop.h) return;
      const pixel = y * crop.w + x;
      if (visited[pixel]) return;
      visited[pixel] = 1;
      if (!isConnectedBackground(data, pixel * 4)) return;
      queue[tail] = pixel;
      tail += 1;
    }

    for (let x = 0; x < crop.w; x += 1) {
      enqueue(x, 0);
      enqueue(x, crop.h - 1);
    }
    for (let y = 1; y < crop.h - 1; y += 1) {
      enqueue(0, y);
      enqueue(crop.w - 1, y);
    }

    while (head < tail) {
      const pixel = queue[head];
      head += 1;
      const x = pixel % crop.w;
      const y = Math.floor(pixel / crop.w);
      data[pixel * 4 + 3] = 0;
      enqueue(x - 1, y);
      enqueue(x + 1, y);
      enqueue(x, y - 1);
      enqueue(x, y + 1);
    }

    context.putImageData(imageData, 0, 0);

    let minX = crop.w;
    let minY = crop.h;
    let maxX = 0;
    let maxY = 0;
    for (let y = 0; y < crop.h; y += 1) {
      for (let x = 0; x < crop.w; x += 1) {
        if (data[(y * crop.w + x) * 4 + 3] < 12) continue;
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x);
        maxY = Math.max(maxY, y);
      }
    }

    const padding = 8;
    const sx = Math.max(0, minX - padding);
    const sy = Math.max(0, minY - padding);
    const sw = Math.min(crop.w - sx, maxX - minX + 1 + padding * 2);
    const sh = Math.min(crop.h - sy, maxY - minY + 1 + padding * 2);
    const output = document.createElement("canvas");
    output.width = sw;
    output.height = sh;
    output.getContext("2d").drawImage(canvas, sx, sy, sw, sh, 0, 0, sw, sh);

    return new Promise((resolve) => {
      output.toBlob((blob) => resolve(URL.createObjectURL(blob)), "image/png");
    });
  }

  async function prepareCatArt() {
    try {
      const source = await loadImage(CAT_SOURCE);
      const urls = await Promise.all(CAT_CROPS.map((crop) => extractTransparentCat(source, crop)));
      urls.forEach((url, index) => {
        document.documentElement.style.setProperty(`--cat-${index}`, `url("${url}")`);
      });
      document.body.classList.add("cats-ready");
    } catch {
      showToast("ネコ画像を読み込めませんでした");
    }
  }

  function stageSize() {
    return { width: el.playfield.clientWidth, height: el.playfield.clientHeight };
  }

  function setupPhysics() {
    if (runner) Runner.stop(runner);
    if (engine) Composite.clear(engine.world, false, true);
    el.catLayer.replaceChildren();
    bodies = new Set();

    const { width, height } = stageSize();
    engine = Engine.create({ enableSleeping: true });
    engine.gravity.y = 1.08;
    engine.positionIterations = 12;
    engine.velocityIterations = 10;
    engine.constraintIterations = 4;

    const plateWidth = Math.min(width * (width <= 600 ? 0.76 : 0.64), 650);
    const plateY = height - 100;

    const plateOptions = {
      label: "plate",
      restitution: 0.025,
      friction: 1,
      frictionStatic: 2.1,
      density: 0.0046,
      sleepThreshold: 90,
    };
    const plateBase = Bodies.rectangle(width / 2, plateY, plateWidth - 12, 24, {
      ...plateOptions,
      chamfer: { radius: 12 },
    });
    const leftLip = Bodies.circle(width / 2 - plateWidth / 2 + 15, plateY - 9, 12, plateOptions);
    const rightLip = Bodies.circle(width / 2 + plateWidth / 2 - 15, plateY - 9, 12, plateOptions);
    plateBody = Body.create({ parts: [plateBase, leftLip, rightLip], ...plateOptions });
    Body.setInertia(plateBody, plateBody.inertia * 1.75);
    plateConstraint = Constraint.create({
      pointA: { x: width / 2, y: plateY },
      bodyB: plateBody,
      pointB: { x: 0, y: 0 },
      length: 0,
      stiffness: 0.98,
      damping: 0.18,
    });

    Composite.add(engine.world, [plateBody, plateConstraint]);
    Events.on(engine, "beforeUpdate", stabilizePlate);
    Events.on(engine, "collisionStart", handleCollisions);

    runner = Runner.create({ delta: 1000 / 60 });
    Runner.run(runner, engine);

    aimX = width / 2;
    updateGuidePosition();
    resetPlateView();
  }

  function stabilizePlate() {
    if (!plateBody || state === "gameover") return;
    const angle = plateBody.angle;
    const restoring = -angle * plateBody.mass * 0.0023;
    const damping = -plateBody.angularVelocity * plateBody.mass * 0.048;
    plateBody.torque += restoring + damping;

    if (Math.abs(angle) > 0.4) {
      plateBody.torque += -Math.sign(angle) * (Math.abs(angle) - 0.4) * plateBody.mass * 0.018;
    }
    if (Math.abs(plateBody.angularVelocity) > 0.055) {
      Body.setAngularVelocity(plateBody, Math.sign(plateBody.angularVelocity) * 0.055);
    }

    for (const cat of bodies) {
      if (Math.abs(cat.angularVelocity) > 0.17) {
        Body.setAngularVelocity(cat, Math.sign(cat.angularVelocity) * 0.17);
      }
      const speed = Math.hypot(cat.velocity.x, cat.velocity.y);
      if (speed > 15) Body.setVelocity(cat, { x: cat.velocity.x * 0.82, y: cat.velocity.y * 0.82 });
    }
  }

  function startGame() {
    setupPhysics();
    score = 0;
    state = "playing";
    canDrop = true;
    tiltStartedAt = 0;
    nextLevel = randomSpawnLevel();
    el.startOverlay.hidden = true;
    el.resultOverlay.hidden = true;
    el.dropButton.disabled = false;
    el.mobileDropButton.hidden = false;
    el.guide.style.opacity = "1";
    updateScore();
    updateNext();
    el.playfield.focus({ preventScroll: true });
    playTone([[520, 0, .06], [720, .06, .1]], "triangle", .07);
  }

  function endGame() {
    if (state !== "playing") return;
    state = "gameover";
    canDrop = false;
    saveBest();
    updateScore();
    el.dropButton.disabled = true;
    el.mobileDropButton.hidden = true;
    el.guide.style.opacity = "0";
    el.resultScore.textContent = score.toLocaleString("ja-JP");
    el.resultMessage.textContent = score >= 700
      ? "見事なネコ山！ デカネコもご満悦。"
      : score >= 250
        ? "いい積みっぷり。次はデカネコまで！"
        : "こんどは、もう少し真ん中へ。";
    el.resultOverlay.hidden = false;
    playTone([[180, 0, .22], [125, .1, .34]], "sawtooth", .08);

    if (plateConstraint) {
      Composite.remove(engine.world, plateConstraint);
      plateConstraint = null;
    }
  }

  function dropCat() {
    if (state !== "playing" || !canDrop) return;
    canDrop = false;
    el.dropButton.disabled = true;
    const level = nextLevel;
    createCat(level, aimX, 52, { angle: (Math.random() - .5) * .1 });
    score += 2;
    updateScore();
    playTone([[280, 0, .04]], "sine", .045);
    nextLevel = randomSpawnLevel();
    updateNext();

    window.setTimeout(() => {
      if (state !== "playing") return;
      canDrop = true;
      el.dropButton.disabled = false;
    }, 520);
  }

  function createCat(level, x, y, options = {}) {
    const spec = CAT_SPECS[level];
    const scaled = (value) => value * GAME_CAT_SCALE;
    const bodyOptions = {
      label: `cat-${level}`,
      restitution: 0.018,
      friction: 0.96,
      frictionStatic: 1.9,
      frictionAir: 0.015,
      density: 0.00108,
      slop: 0.025,
      sleepThreshold: 28,
    };
    const parts = [];
    if (level === 0) {
      parts.push(Bodies.circle(x, y - scaled(19), scaled(27), bodyOptions));
      parts.push(Bodies.rectangle(x, y + scaled(18), scaled(64), scaled(54), { ...bodyOptions, chamfer: { radius: scaled(23) } }));
    } else if (level === 1) {
      parts.push(Bodies.rectangle(x, y, scaled(92), scaled(56), { ...bodyOptions, chamfer: { radius: scaled(26) } }));
      parts.push(Bodies.circle(x + scaled(34), y + scaled(3), scaled(27), bodyOptions));
    } else if (level === 2) {
      parts.push(Bodies.rectangle(x, y, scaled(112), scaled(50), { ...bodyOptions, chamfer: { radius: scaled(25) } }));
      parts.push(Bodies.circle(x - scaled(45), y + scaled(1), scaled(25), bodyOptions));
    } else if (level === 3) {
      parts.push(Bodies.rectangle(x, y, scaled(122), scaled(74), { ...bodyOptions, chamfer: { radius: scaled(32) } }));
    } else if (level === 4) {
      parts.push(Bodies.rectangle(x, y + scaled(5), scaled(134), scaled(62), { ...bodyOptions, chamfer: { radius: scaled(29) } }));
      parts.push(Bodies.circle(x - scaled(51), y - scaled(5), scaled(28), bodyOptions));
    } else {
      parts.push(Bodies.circle(x, y - scaled(34), scaled(36), bodyOptions));
      parts.push(Bodies.circle(x, y + scaled(28), scaled(59), bodyOptions));
    }
    const body = parts.length === 1 ? parts[0] : Body.create({ parts, ...bodyOptions });
    Body.setPosition(body, { x, y });
    Body.setAngle(body, options.angle || 0);
    body.catLevel = level;
    body.isMerging = false;

    const art = document.createElement("div");
    art.className = `physics-cat cat-level-${level}`;
    art.style.width = `${spec.art * GAME_CAT_SCALE}px`;
    art.style.height = `${spec.art * GAME_CAT_SCALE}px`;
    art.dataset.level = String(level);
    el.catLayer.append(art);
    body.art = art;
    bodies.add(body);
    Composite.add(engine.world, body);
    return body;
  }

  function handleCollisions(event) {
    if (state !== "playing") return;
    for (const pair of event.pairs) {
      const a = pair.bodyA.parent || pair.bodyA;
      const b = pair.bodyB.parent || pair.bodyB;
      if (!bodies.has(a) || !bodies.has(b)) continue;
      if (a.catLevel !== b.catLevel || a.catLevel >= CAT_SPECS.length - 1) continue;
      if (a.isMerging || b.isMerging) continue;

      a.isMerging = true;
      b.isMerging = true;
      window.setTimeout(() => mergeCats(a, b), 70);
    }
  }

  function mergeCats(a, b) {
    if (state !== "playing" || !bodies.has(a) || !bodies.has(b)) return;
    const level = a.catLevel + 1;
    const x = (a.position.x + b.position.x) / 2;
    const y = (a.position.y + b.position.y) / 2;
    const velocity = {
      x: (a.velocity.x + b.velocity.x) * .2,
      y: Math.max(-2.2, Math.min(-0.8, (a.velocity.y + b.velocity.y) * .08 - 1.1)),
    };

    removeCat(a);
    removeCat(b);
    const merged = createCat(level, x, y, { angle: (a.angle + b.angle) / 2 });
    Body.setVelocity(merged, velocity);
    score += CAT_SPECS[level].score;
    updateScore();
    const tableCell = el.evolutionCells.find((cell) => Number(cell.dataset.mergeLevel) === level);
    if (tableCell) {
      tableCell.classList.remove("is-made");
      void tableCell.offsetWidth;
      tableCell.classList.add("is-made");
    }
    burst(x, y, level);
    showToast(level === 5 ? "デカネコ、できた！" : `${CAT_NAMES[level]}に合体！`);
    playMerge(level);
  }

  function removeCat(body) {
    bodies.delete(body);
    Composite.remove(engine.world, body);
    body.art?.remove();
  }

  function updateScore() {
    el.score.textContent = score.toLocaleString("ja-JP");
    el.best.textContent = Math.max(best, score).toLocaleString("ja-JP");
  }

  function updateNext() {
    for (let i = 0; i < CAT_SPECS.length; i += 1) {
      el.nextCat.classList.toggle(`cat-level-${i}`, i === nextLevel);
      el.guideCat.classList.toggle(`cat-level-${i}`, i === nextLevel);
    }
    el.catName.textContent = CAT_NAMES[nextLevel];
  }

  function setAimFromClientX(clientX) {
    const rect = el.playfield.getBoundingClientRect();
    const margin = Math.min(92, rect.width * .14);
    aimX = Math.max(margin, Math.min(rect.width - margin, clientX - rect.left));
    updateGuidePosition();
  }

  function updateGuidePosition() {
    el.guide.style.left = `${aimX}px`;
  }

  function render(now) {
    const { width, height } = stageSize();
    if (plateBody) {
      el.plate.style.transform = `rotate(${plateBody.angle}rad)`;
      const normalized = Math.max(-1, Math.min(1, plateBody.angle / MAX_TILT));
      el.tiltNeedle.style.left = `${50 + normalized * 46}%`;
      const abs = Math.abs(normalized);
      if (abs < .34) {
        el.tiltLabel.textContent = "あんてい";
        el.tiltLabel.style.color = "var(--moss)";
      } else if (abs < .72) {
        el.tiltLabel.textContent = "ゆらゆら";
        el.tiltLabel.style.color = "#bd7a24";
      } else {
        el.tiltLabel.textContent = "あぶない！";
        el.tiltLabel.style.color = "#c45c44";
      }

      if (state === "playing" && abs > .93) {
        if (!tiltStartedAt) tiltStartedAt = now;
        if (now - tiltStartedAt > 420) endGame();
      } else {
        tiltStartedAt = 0;
      }
    }

    for (const body of [...bodies]) {
      const artSize = CAT_SPECS[body.catLevel].art * GAME_CAT_SCALE;
      body.art.style.transform = `translate3d(${body.position.x - artSize / 2}px, ${body.position.y - artSize / 2}px, 0) rotate(${body.angle}rad)`;

      if (
        state === "playing" &&
        (body.position.y > height - 12 || body.position.x < -45 || body.position.x > width + 45)
      ) {
        endGame();
      }

      if (state === "gameover" && body.position.y > height + 220) removeCat(body);
    }

    drawParticles(now);
    animationId = requestAnimationFrame(render);
  }

  function resetPlateView() {
    el.plate.style.transform = "rotate(0rad)";
    el.tiltNeedle.style.left = "50%";
    el.tiltLabel.textContent = "あんてい";
    el.tiltLabel.style.color = "var(--moss)";
  }

  function resizeEffects() {
    const rect = el.playfield.getBoundingClientRect();
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    el.effectsCanvas.width = Math.round(rect.width * ratio);
    el.effectsCanvas.height = Math.round(rect.height * ratio);
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  }

  function burst(x, y, level) {
    const colors = ["#f2bd32", "#e88724", "#e99579", "#78805a", "#fff8ea"];
    for (let i = 0; i < 18; i += 1) {
      const angle = (Math.PI * 2 * i) / 18 + Math.random() * .25;
      const speed = 1.6 + Math.random() * 3 + level * .18;
      particles.push({
        x, y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 1.3,
        life: 1,
        size: 3 + Math.random() * 5,
        color: colors[i % colors.length],
      });
    }
  }

  function drawParticles(now) {
    const rect = el.playfield.getBoundingClientRect();
    ctx.clearRect(0, 0, rect.width, rect.height);
    const dt = Math.min(2.2, Math.max(.4, (now - lastFrameAt) / 16.67));
    lastFrameAt = now;
    particles = particles.filter((p) => {
      p.vy += .11 * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.life -= .025 * dt;
      if (p.life <= 0) return false;
      ctx.globalAlpha = Math.max(0, p.life);
      ctx.fillStyle = p.color;
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.life * 4);
      ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size);
      ctx.restore();
      return true;
    });
    ctx.globalAlpha = 1;
  }

  function showToast(message) {
    const toast = document.createElement("div");
    toast.className = "merge-toast";
    toast.textContent = message;
    el.playfield.append(toast);
    requestAnimationFrame(() => toast.classList.add("is-visible"));
    window.setTimeout(() => {
      toast.classList.remove("is-visible");
      window.setTimeout(() => toast.remove(), 220);
    }, 900);
  }

  function playTone(notes, wave = "sine", volume = .05) {
    if (!soundOn) return;
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    const audio = new AudioContext();
    for (const [frequency, delay, duration] of notes) {
      const oscillator = audio.createOscillator();
      const gain = audio.createGain();
      const starts = audio.currentTime + delay;
      oscillator.type = wave;
      oscillator.frequency.setValueAtTime(frequency, starts);
      gain.gain.setValueAtTime(.0001, starts);
      gain.gain.linearRampToValueAtTime(volume, starts + .015);
      gain.gain.exponentialRampToValueAtTime(.0001, starts + duration);
      oscillator.connect(gain).connect(audio.destination);
      oscillator.start(starts);
      oscillator.stop(starts + duration + .02);
    }
  }

  function playMerge(level) {
    const base = 380 + level * 75;
    playTone([[base, 0, .08], [base * 1.25, .05, .1], [base * 1.5, .1, .14]], "triangle", .07);
  }

  el.startButton.addEventListener("click", startGame);
  el.retryButton.addEventListener("click", startGame);
  el.dropButton.addEventListener("click", dropCat);
  el.mobileDropButton.addEventListener("click", dropCat);

  el.playfield.addEventListener("pointermove", (event) => {
    if (state !== "playing") return;
    setAimFromClientX(event.clientX);
  });

  el.playfield.addEventListener("pointerdown", (event) => {
    if (state !== "playing") return;
    setAimFromClientX(event.clientX);
    if (event.pointerType !== "touch" && !event.target.closest("button")) dropCat();
  });

  window.addEventListener("keydown", (event) => {
    if (event.code === "Space") {
      event.preventDefault();
      if (state === "idle") startGame();
      else if (state === "playing") dropCat();
    }
    if (state !== "playing") return;
    if (event.code === "ArrowLeft" || event.code === "ArrowRight") {
      event.preventDefault();
      const direction = event.code === "ArrowLeft" ? -1 : 1;
      const { width } = stageSize();
      aimX = Math.max(60, Math.min(width - 60, aimX + direction * 24));
      updateGuidePosition();
    }
  });

  el.soundButton.addEventListener("click", () => {
    soundOn = !soundOn;
    el.soundButton.setAttribute("aria-pressed", String(soundOn));
    el.soundButton.setAttribute("aria-label", soundOn ? "音をオフにする" : "音をオンにする");
    el.soundLabel.textContent = soundOn ? "ON" : "OFF";
    if (soundOn) playTone([[620, 0, .07]], "triangle", .055);
  });

  const resizeObserver = new ResizeObserver(() => {
    resizeEffects();
    if (state === "idle") {
      aimX = stageSize().width / 2;
      updateGuidePosition();
    }
  });
  resizeObserver.observe(el.playfield);

  el.best.textContent = best.toLocaleString("ja-JP");
  prepareCatArt();
  updateNext();
  setupPhysics();
  animationId = requestAnimationFrame(render);

  window.addEventListener("pagehide", () => {
    if (animationId) cancelAnimationFrame(animationId);
    if (runner) Runner.stop(runner);
  });
})();
