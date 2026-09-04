(() => {
  "use strict";

  const { Engine, Runner, Bodies, Body, Composite, Constraint, Events } = Matter;
  const STORAGE_KEY = "nekomori:best-score";
  const CAT_NAMES = ["しまねこ", "まるねこ", "しろふわ", "みけねこ", "のびねこ", "デカネコ"];
  const CAT_SPECS = [
    { w: 58, h: 68, art: 103, chamfer: 20, score: 8 },
    { w: 80, h: 48, art: 112, chamfer: 22, score: 22 },
    { w: 104, h: 47, art: 132, chamfer: 22, score: 54 },
    { w: 108, h: 57, art: 140, chamfer: 24, score: 120 },
    { w: 134, h: 60, art: 164, chamfer: 26, score: 260 },
    { w: 112, h: 116, art: 166, chamfer: 42, score: 600 },
  ];
  const SPAWN_POOL = [0, 0, 0, 0, 1, 1, 1, 2];
  const MAX_TILT = 0.48;

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
    engine.positionIterations = 8;
    engine.velocityIterations = 6;

    const plateWidth = Math.min(width * (width <= 600 ? 0.76 : 0.64), 650);
    const plateY = height - 100;

    plateBody = Bodies.rectangle(width / 2, plateY, plateWidth - 10, 27, {
      label: "plate",
      restitution: 0.08,
      friction: 0.92,
      frictionStatic: 1.7,
      density: 0.006,
      chamfer: { radius: 13 },
      sleepThreshold: 90,
    });
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
    const restoring = -plateBody.angle * plateBody.mass * 0.0042;
    const damping = -plateBody.angularVelocity * plateBody.mass * 0.052;
    plateBody.torque += restoring + damping;

    if (plateBody.angle > 0.62) Body.setAngle(plateBody, 0.62);
    if (plateBody.angle < -0.62) Body.setAngle(plateBody, -0.62);
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
    createCat(level, aimX, 52, { angle: (Math.random() - .5) * .18 });
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
    const body = Bodies.rectangle(x, y, spec.w, spec.h, {
      label: `cat-${level}`,
      angle: options.angle || 0,
      restitution: 0.04,
      friction: 0.88,
      frictionStatic: 1.6,
      frictionAir: 0.008,
      density: 0.00115,
      chamfer: { radius: spec.chamfer },
      sleepThreshold: 35,
    });
    body.catLevel = level;
    body.isMerging = false;

    const art = document.createElement("div");
    art.className = `physics-cat cat-level-${level}`;
    art.style.width = `${spec.art}px`;
    art.style.height = `${spec.art}px`;
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
      const a = pair.bodyA;
      const b = pair.bodyB;
      if (!bodies.has(a) || !bodies.has(b)) continue;
      if (a.catLevel !== b.catLevel || a.catLevel >= CAT_SPECS.length - 1) continue;
      if (a.isMerging || b.isMerging) continue;

      a.isMerging = true;
      b.isMerging = true;
      window.setTimeout(() => mergeCats(a, b), 30);
    }
  }

  function mergeCats(a, b) {
    if (state !== "playing" || !bodies.has(a) || !bodies.has(b)) return;
    const level = a.catLevel + 1;
    const x = (a.position.x + b.position.x) / 2;
    const y = (a.position.y + b.position.y) / 2;
    const velocity = {
      x: (a.velocity.x + b.velocity.x) * .2,
      y: Math.min(-1.8, (a.velocity.y + b.velocity.y) * .12 - 1.3),
    };

    removeCat(a);
    removeCat(b);
    const merged = createCat(level, x, y, { angle: (a.angle + b.angle) / 2 });
    Body.setVelocity(merged, velocity);
    score += CAT_SPECS[level].score;
    updateScore();
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
      const artSize = CAT_SPECS[body.catLevel].art;
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
  updateNext();
  setupPhysics();
  animationId = requestAnimationFrame(render);

  window.addEventListener("pagehide", () => {
    if (animationId) cancelAnimationFrame(animationId);
    if (runner) Runner.stop(runner);
  });
})();
