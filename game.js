/**
 * NevePoint – Game Logic
 *
 * Players click / tap snowflakes to score points.
 * Missing a snowflake (letting it reach the ground) costs a life.
 * Every 10 points the level increases and snowflakes fall faster.
 */

(function () {
  "use strict";

  /* ── DOM references ── */
  const canvas = document.getElementById("game-canvas");
  const ctx = canvas.getContext("2d");
  const scoreEl = document.getElementById("score");
  const levelEl = document.getElementById("level");
  const livesEl = document.getElementById("lives");
  const overlay = document.getElementById("overlay");
  const overlayTitle = document.getElementById("overlay-title");
  const overlayMsg = document.getElementById("overlay-message");
  const overlayBtn = document.getElementById("overlay-btn");
  const main = canvas.parentElement;

  /* ── Game state ── */
  const STATE = { IDLE: "idle", PLAYING: "playing", OVER: "over" };
  let state = STATE.IDLE;
  let score = 0;
  let level = 1;
  let lives = 3;
  let flakes = [];
  let animId = null;
  let spawnTimer = 0;

  /* ── Constants ── */
  const POINTS_PER_FLAKE = 10;
  const POINTS_TO_LEVEL_UP = 10;
  const MAX_LIVES = 3;
  const BASE_SPEED = 1.2;   // px per frame at level 1
  const SPEED_INC = 0.35;   // extra speed per level
  const BASE_SPAWN = 90;    // frames between spawns at level 1
  const SPAWN_DEC = 6;      // frames reduction per level
  const MIN_SPAWN = 20;

  /* ── Snowflake characters ── */
  const GLYPHS = ["❄", "❅", "❆", "✦", "✧", "⁕"];

  /* ── Resize canvas to match CSS layout ── */
  function resize() {
    canvas.width = canvas.offsetWidth;
    canvas.height = canvas.offsetHeight;
  }

  window.addEventListener("resize", resize);
  resize();

  /* ── Snowflake factory ── */
  function createFlake() {
    const size = 18 + Math.random() * 24;
    return {
      x: size + Math.random() * (canvas.width - size * 2),
      y: -size,
      size,
      glyph: GLYPHS[Math.floor(Math.random() * GLYPHS.length)],
      speed: BASE_SPEED + SPEED_INC * (level - 1) + Math.random() * 0.6,
      opacity: 0.65 + Math.random() * 0.35,
      drift: (Math.random() - 0.5) * 0.5,
      angle: Math.random() * Math.PI * 2,
      spin: (Math.random() - 0.5) * 0.04,
    };
  }

  /* ── Draw a single snowflake ── */
  function drawFlake(f) {
    ctx.save();
    ctx.globalAlpha = f.opacity;
    ctx.font = `${f.size}px serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.translate(f.x, f.y);
    ctx.rotate(f.angle);
    ctx.fillText(f.glyph, 0, 0);
    ctx.restore();
  }

  /* ── Update state for one frame ── */
  function update() {
    spawnTimer++;
    const spawnInterval = Math.max(MIN_SPAWN, BASE_SPAWN - SPAWN_DEC * (level - 1));
    if (spawnTimer >= spawnInterval) {
      flakes.push(createFlake());
      spawnTimer = 0;
    }

    for (let i = flakes.length - 1; i >= 0; i--) {
      const f = flakes[i];
      f.y += f.speed;
      f.x += f.drift;
      f.angle += f.spin;

      if (f.y - f.size > canvas.height) {
        flakes.splice(i, 1);
        loseLife();
      }
    }
  }

  /* ── Render one frame ── */
  function render() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    /* Subtle starfield background */
    ctx.fillStyle = "rgba(255,255,255,0.18)";
    for (let i = 0; i < 60; i++) {
      /* deterministic "random" positions based on index */
      const sx = ((i * 137.508) % canvas.width);
      const sy = ((i * 251.113) % canvas.height);
      ctx.beginPath();
      ctx.arc(sx, sy, 0.8, 0, Math.PI * 2);
      ctx.fill();
    }

    flakes.forEach(drawFlake);
  }

  /* ── Main loop ── */
  function loop() {
    update();
    render();
    animId = requestAnimationFrame(loop);
  }

  /* ── Score / level helpers ── */
  function addScore(points) {
    score += points;
    const newLevel = Math.floor(score / POINTS_TO_LEVEL_UP) + 1;
    if (newLevel !== level) {
      level = newLevel;
      levelEl.textContent = level;
    }
    scoreEl.textContent = score;
  }

  function loseLife() {
    lives = Math.max(0, lives - 1);
    livesEl.textContent = lives;
    if (lives === 0) endGame();
  }

  /* ── Pop label animation ── */
  function showPop(x, y, text) {
    const el = document.createElement("span");
    el.className = "catch-pop";
    el.textContent = text;
    el.style.left = `${x}px`;
    el.style.top = `${y}px`;
    main.appendChild(el);
    el.addEventListener("animationend", () => el.remove());
  }

  /* ── Hit-test: returns index of clicked flake, or -1 ── */
  function hitTest(cx, cy) {
    for (let i = flakes.length - 1; i >= 0; i--) {
      const f = flakes[i];
      const dx = cx - f.x;
      const dy = cy - f.y;
      if (dx * dx + dy * dy <= (f.size * 0.9) ** 2) return i;
    }
    return -1;
  }

  /* ── Pointer handler (mouse & touch) ── */
  function onPointer(evt) {
    if (state !== STATE.PLAYING) return;
    evt.preventDefault();

    const rect = canvas.getBoundingClientRect();
    const touches = evt.changedTouches;
    const points = touches
      ? Array.from(touches).map((t) => ({ x: t.clientX - rect.left, y: t.clientY - rect.top }))
      : [{ x: evt.clientX - rect.left, y: evt.clientY - rect.top }];

    points.forEach(({ x, y }) => {
      const idx = hitTest(x, y);
      if (idx !== -1) {
        const pts = POINTS_PER_FLAKE * level;
        flakes.splice(idx, 1);
        addScore(pts);
        showPop(x, y, `+${pts}`);
      }
    });
  }

  canvas.addEventListener("click", onPointer);
  canvas.addEventListener("touchstart", onPointer, { passive: false });

  /* ── Game flow ── */
  function startGame() {
    score = 0;
    level = 1;
    lives = MAX_LIVES;
    flakes = [];
    spawnTimer = 0;

    scoreEl.textContent = score;
    levelEl.textContent = level;
    livesEl.textContent = lives;

    overlay.classList.add("hidden");
    state = STATE.PLAYING;

    if (animId) cancelAnimationFrame(animId);
    loop();
  }

  function endGame() {
    state = STATE.OVER;
    if (animId) {
      cancelAnimationFrame(animId);
      animId = null;
    }

    overlayTitle.textContent = "Game Over";
    overlayMsg.textContent = `You scored ${score} point${score !== 1 ? "s" : ""} on level ${level}!`;
    overlayBtn.textContent = "Play Again";
    overlay.classList.remove("hidden");
  }

  overlayBtn.addEventListener("click", startGame);

  /* ── Keyboard shortcut: Space / Enter to start ── */
  document.addEventListener("keydown", (e) => {
    if ((e.code === "Space" || e.code === "Enter") && state !== STATE.PLAYING) {
      startGame();
    }
  });
})();
