// Waterbender Arena (Beginner-friendly)
// This game uses only HTML/CSS/JS and HTML5 canvas.

const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

const ui = {
  health: document.getElementById("healthText"),
  water: document.getElementById("waterText"),
  score: document.getElementById("scoreText"),
  wave: document.getElementById("waveText"),
  level: document.getElementById("levelText"),
  pause: document.getElementById("pauseBtn"),
  restartTop: document.getElementById("restartTopBtn"),
  gameOver: document.getElementById("gameOverPanel"),
  finalScore: document.getElementById("finalScore"),
  restart: document.getElementById("restartBtn"),
  levelPanel: document.getElementById("levelPanel"),
  levelChoices: document.getElementById("levelChoices"),
};

const state = {
  keys: {},
  mouse: { x: canvas.width / 2, y: canvas.height / 2 },
  draggingOrb: false,
  dragType: "water", // water or ice (space during drag makes ice)
  dragPos: { x: 0, y: 0 },
  dragLastDir: { x: 1, y: 0 },
  rightDown: false,
  hitMemory: new Set(),
  enemies: [],
  particles: [],
  projectiles: [],
  waveRings: [],
  structures: [],
  score: 0,
  xp: 0,
  level: 1,
  wave: 1,
  waveTarget: 5,
  waveDefeated: 0,
  spawnTimer: 0,
  gameOver: false,
  betweenWaves: false,
  paused: false,
  lastTime: 0,
};

const player = {
  x: canvas.width / 2,
  y: canvas.height / 2,
  r: 16,
  speed: 250,
  maxHealth: 100,
  health: 100,
  maxWater: 100,
  water: 100,
  waterRegen: 18,
  orbRadius: 36,
  orbAngle: 0,
  orbX: 0,
  orbY: 0,
  whipDamage: 18,
  launchDamage: 24,
  waveDamage: 18,
  wavePush: 340,
  waveRange: 110,
  freezeDuration: 2,
  waveCooldown: 0,
  waveCost: 24,
  canWave: false,
  canIce: false,
  walkAnim: 0,
};

const upgrades = [
  { id: "unlockWave", name: "Unlock Water Wave", desc: "Right click creates a push wave.", take: () => (player.canWave = true), once: true },
  { id: "unlockIce", name: "Unlock Ice Whip", desc: "Press Space while dragging to freeze.", take: () => (player.canIce = true), once: true },
  { id: "regen", name: "Deep Breath", desc: "+6 water regen.", take: () => (player.waterRegen += 6) },
  { id: "maxWater", name: "Bigger Orb", desc: "+25 max water.", take: () => { player.maxWater += 25; player.water += 25; } },
  { id: "power", name: "Stronger Whip", desc: "+6 whip damage.", take: () => { player.whipDamage += 6; player.launchDamage += 6; } },
  { id: "health", name: "Vital Flow", desc: "+20 max health + heal.", take: () => { player.maxHealth += 20; player.health = player.maxHealth; } },
  { id: "wavePlus", name: "Wave Mastery", desc: "+range +damage for wave.", take: () => { player.waveRange += 25; player.waveDamage += 8; } },
];

function rand(min, max) { return Math.random() * (max - min) + min; }
function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }
function dist(ax, ay, bx, by) { return Math.hypot(ax - bx, ay - by); }

function addParticles(x, y, color, count, speed = 130) {
  for (let i = 0; i < count; i++) {
    const a = rand(0, Math.PI * 2);
    const s = rand(speed * 0.4, speed);
    state.particles.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: rand(0.2, 0.8), max: 0.8, color, size: rand(2, 5) });
  }
}

function makeStructuresForWave() {
  // Structures change every wave. They act as visual + movement blockers.
  state.structures = [];
  const count = clamp(2 + Math.floor(state.wave / 2), 2, 5);
  for (let i = 0; i < count; i++) {
    const w = rand(80, 140);
    const h = rand(50, 110);
    state.structures.push({ x: rand(100, canvas.width - 200), y: rand(90, canvas.height - 180), w, h, phase: rand(0, Math.PI * 2) });
  }
}

function circleRectBlocked(x, y, r, s) {
  const nx = clamp(x, s.x, s.x + s.w);
  const ny = clamp(y, s.y, s.y + s.h);
  return dist(x, y, nx, ny) < r;
}

function moveWithStructures(entity, nx, ny) {
  let tx = clamp(nx, entity.r, canvas.width - entity.r);
  let ty = clamp(ny, entity.r, canvas.height - entity.r);
  for (const s of state.structures) {
    if (circleRectBlocked(tx, ty, entity.r, s)) {
      tx = entity.x;
      ty = entity.y;
      break;
    }
  }
  entity.x = tx;
  entity.y = ty;
}

function spawnEnemy() {
  // Fewer enemies and more unique movement styles.
  const side = Math.floor(rand(0, 4));
  let x = 0;
  let y = 0;
  if (side === 0) { x = rand(0, canvas.width); y = -24; }
  if (side === 1) { x = canvas.width + 24; y = rand(0, canvas.height); }
  if (side === 2) { x = rand(0, canvas.width); y = canvas.height + 24; }
  if (side === 3) { x = -24; y = rand(0, canvas.height); }

  const styles = ["chase", "orbit", "zigzag", "dash"];
  const type = styles[Math.floor(rand(0, styles.length))];
  state.enemies.push({
    x, y, r: 14, hp: 38 + state.wave * 4, speed: rand(65, 95) + state.wave * 4,
    type, frozen: 0, hitFlash: 0, walkAnim: rand(0, Math.PI * 2), aiTimer: rand(0.8, 1.8), dashReady: true,
  });
}

function startNextWave() {
  state.wave += state.betweenWaves ? 1 : 0;
  state.waveDefeated = 0;
  state.waveTarget = 4 + state.wave * 2;
  state.spawnTimer = 0.7;
  state.betweenWaves = false;
  makeStructuresForWave();
}

function openLevelChoices() {
  state.betweenWaves = true;
  ui.levelPanel.classList.remove("hidden");
  ui.levelChoices.innerHTML = "";

  const owned = new Set();
  if (player.canWave) owned.add("unlockWave");
  if (player.canIce) owned.add("unlockIce");

  const pool = upgrades.filter((u) => !(u.once && owned.has(u.id)));
  const picks = [];
  while (picks.length < 3 && pool.length > 0) {
    const idx = Math.floor(rand(0, pool.length));
    picks.push(pool.splice(idx, 1)[0]);
  }

  for (const pick of picks) {
    const card = document.createElement("div");
    card.className = "choice";
    card.innerHTML = `<h3>${pick.name}</h3><p>${pick.desc}</p><button>Choose</button>`;
    card.querySelector("button").addEventListener("click", () => {
      pick.take();
      player.water = clamp(player.water, 0, player.maxWater);
      state.level += 1;
      ui.levelPanel.classList.add("hidden");
      startNextWave();
    });
    ui.levelChoices.appendChild(card);
  }
}

function beginDragIfOnOrb() {
  if (state.gameOver || state.betweenWaves) return;
  const d = dist(state.mouse.x, state.mouse.y, player.orbX, player.orbY);
  if (d < 18 && player.water > 1) {
    state.draggingOrb = true;
    state.dragType = "water";
    state.dragPos.x = player.orbX;
    state.dragPos.y = player.orbY;
    state.dragLastDir = { x: 1, y: 0 };
    state.hitMemory.clear();
  }
}

function releaseDrag() {
  if (!state.draggingOrb) return;
  state.draggingOrb = false;

  // On release, launch water in last dragged direction.
  const cost = state.dragType === "ice" ? 16 : 10;
  if (player.water < cost) return;
  player.water -= cost;

  state.projectiles.push({
    x: state.dragPos.x,
    y: state.dragPos.y,
    vx: state.dragLastDir.x * 420,
    vy: state.dragLastDir.y * 420,
    r: state.dragType === "ice" ? 10 : 8,
    damage: player.launchDamage,
    life: 1.3,
    type: state.dragType,
  });
  addParticles(state.dragPos.x, state.dragPos.y, state.dragType === "ice" ? "#d7f8ff" : "#66dcff", 14, 180);
}

function updatePlayer(dt) {
  let mx = 0;
  let my = 0;
  if (state.keys.w) my -= 1;
  if (state.keys.s) my += 1;
  if (state.keys.a) mx -= 1;
  if (state.keys.d) mx += 1;

  const len = Math.hypot(mx, my) || 1;
  moveWithStructures(player, player.x + (mx / len) * player.speed * dt, player.y + (my / len) * player.speed * dt);

  player.walkAnim += dt * 8;
  player.orbAngle += dt * 2.6;
  player.water = clamp(player.water + player.waterRegen * dt, 0, player.maxWater);
  player.waveCooldown = Math.max(0, player.waveCooldown - dt);

  // Orb idle follows player when not dragging.
  if (!state.draggingOrb) {
    player.orbX = player.x + Math.cos(player.orbAngle) * player.orbRadius;
    player.orbY = player.y + Math.sin(player.orbAngle) * player.orbRadius;
    return;
  }

  // Orb follows the mouse while dragging.
  const dx = state.mouse.x - state.dragPos.x;
  const dy = state.mouse.y - state.dragPos.y;
  const d = Math.hypot(dx, dy) || 1;
  const speed = 650;
  state.dragPos.x += (dx / d) * speed * dt;
  state.dragPos.y += (dy / d) * speed * dt;

  const dragDist = dist(player.x, player.y, state.dragPos.x, state.dragPos.y);
  if (dragDist > 170) {
    const nx = (state.dragPos.x - player.x) / dragDist;
    const ny = (state.dragPos.y - player.y) / dragDist;
    state.dragPos.x = player.x + nx * 170;
    state.dragPos.y = player.y + ny * 170;
  }

  state.dragLastDir = { x: dx / d, y: dy / d };
  player.orbX = state.dragPos.x;
  player.orbY = state.dragPos.y;

  // Dragging costs water and damages enemies along the whip path.
  player.water = Math.max(0, player.water - 14 * dt);
  for (const e of state.enemies) {
    const nearTip = dist(e.x, e.y, player.orbX, player.orbY) < e.r + 18;
    if (nearTip && !state.hitMemory.has(e)) {
      e.hp -= player.whipDamage;
      e.hitFlash = 0.12;
      if (state.dragType === "ice") e.frozen = player.freezeDuration;
      addParticles(e.x, e.y, state.dragType === "ice" ? "#d9fbff" : "#53d9ff", 8, 120);
      state.hitMemory.add(e);
    }
    if (!nearTip) state.hitMemory.delete(e);
  }

  if (Math.random() < 0.35) addParticles(player.orbX, player.orbY, state.dragType === "ice" ? "#d7f6ff" : "#57d8ff", 1, 60);

  if (player.water <= 0) releaseDrag();
}

function castWave() {
  if (state.gameOver || state.paused || state.betweenWaves) return;
  if (!player.canWave || player.waveCooldown > 0 || player.water < player.waveCost) return;
  player.waveCooldown = 1;
  player.water -= player.waveCost;

  // Ring animation for wave.
  state.waveRings.push({ x: player.x, y: player.y, r: 25, max: player.waveRange, life: 0.35 });
  addParticles(player.x, player.y, "#69dfff", 20, 220);

  for (const e of state.enemies) {
    const d = dist(player.x, player.y, e.x, e.y);
    if (d < player.waveRange) {
      const nx = (e.x - player.x) / (d || 1);
      const ny = (e.y - player.y) / (d || 1);
      e.x += nx * player.wavePush * 0.08;
      e.y += ny * player.wavePush * 0.08;
      e.hp -= player.waveDamage;
      e.hitFlash = 0.15;
    }
  }
}

function updateWaveRings(dt) {
  for (let i = state.waveRings.length - 1; i >= 0; i--) {
    const r = state.waveRings[i];
    r.life -= dt;
    r.r += (r.max - r.r) * 0.22;
    if (r.life <= 0) state.waveRings.splice(i, 1);
  }
}

function updateProjectiles(dt) {
  for (let i = state.projectiles.length - 1; i >= 0; i--) {
    const p = state.projectiles[i];
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.life -= dt;

    for (const e of state.enemies) {
      if (dist(p.x, p.y, e.x, e.y) < p.r + e.r) {
        e.hp -= p.damage;
        if (p.type === "ice") e.frozen = player.freezeDuration;
        e.hitFlash = 0.12;
        addParticles(e.x, e.y, p.type === "ice" ? "#dffbff" : "#52d8ff", 10, 140);
        p.life = 0;
        break;
      }
    }

    if (p.life <= 0 || p.x < -30 || p.x > canvas.width + 30 || p.y < -30 || p.y > canvas.height + 30) {
      state.projectiles.splice(i, 1);
    }
  }
}

function updateEnemyAI(e, dt) {
  const dx = player.x - e.x;
  const dy = player.y - e.y;
  const d = Math.hypot(dx, dy) || 1;
  let vx = 0;
  let vy = 0;

  if (e.type === "chase") {
    vx = (dx / d) * e.speed;
    vy = (dy / d) * e.speed;
  }

  if (e.type === "orbit") {
    const tx = -dy / d;
    const ty = dx / d;
    vx = (dx / d) * e.speed * 0.5 + tx * e.speed * 0.7;
    vy = (dy / d) * e.speed * 0.5 + ty * e.speed * 0.7;
  }

  if (e.type === "zigzag") {
    e.aiTimer -= dt;
    if (e.aiTimer <= 0) e.aiTimer = rand(0.3, 0.9);
    const zig = Math.sin(e.aiTimer * 12) * e.speed * 0.9;
    const tx = -dy / d;
    const ty = dx / d;
    vx = (dx / d) * e.speed + tx * zig;
    vy = (dy / d) * e.speed + ty * zig;
  }

  if (e.type === "dash") {
    e.aiTimer -= dt;
    if (e.aiTimer <= 0) {
      e.aiTimer = rand(1, 2);
      e.dashReady = true;
    }
    const mult = e.dashReady ? 2.4 : 0.7;
    vx = (dx / d) * e.speed * mult;
    vy = (dy / d) * e.speed * mult;
    if (e.dashReady && d < 90) e.dashReady = false;
  }

  moveWithStructures(e, e.x + vx * dt, e.y + vy * dt);
}

function updateEnemies(dt) {
  // Spawn fewer enemies each wave.
  const spawnInterval = clamp(1.5 - state.wave * 0.07, 0.75, 1.5);
  if (state.waveDefeated + state.enemies.length < state.waveTarget) {
    state.spawnTimer -= dt;
    if (state.spawnTimer <= 0) {
      spawnEnemy();
      state.spawnTimer = spawnInterval;
    }
  }

  for (let i = state.enemies.length - 1; i >= 0; i--) {
    const e = state.enemies[i];
    e.walkAnim += dt * 7;
    e.hitFlash = Math.max(0, e.hitFlash - dt);

    if (e.frozen > 0) {
      e.frozen -= dt;
    } else {
      updateEnemyAI(e, dt);
    }

    if (dist(e.x, e.y, player.x, player.y) < e.r + player.r) {
      player.health -= 20 * dt;
      addParticles(player.x, player.y, "#ff8ea0", 1, 45);
    }

    if (e.hp <= 0) {
      state.score += 12;
      state.xp += 8;
      state.waveDefeated += 1;
      addParticles(e.x, e.y, "#8ee7ff", 16, 170);
      state.enemies.splice(i, 1);
    }
  }

  // End-of-wave flow: choose level up.
  if (!state.betweenWaves && state.waveDefeated >= state.waveTarget && state.enemies.length === 0) {
    openLevelChoices();
  }
}

function updateParticles(dt) {
  for (let i = state.particles.length - 1; i >= 0; i--) {
    const p = state.particles[i];
    p.life -= dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vx *= 0.95;
    p.vy *= 0.95;
    if (p.life <= 0) state.particles.splice(i, 1);
  }
}

function drawHumanoid(x, y, color, phase) {
  const leg = Math.sin(phase) * 3;
  const arm = Math.cos(phase) * 3;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(x, y - 14, 7, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = color;
  ctx.lineWidth = 4;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(x, y - 7); ctx.lineTo(x, y + 10);
  ctx.moveTo(x, y - 2); ctx.lineTo(x - 9, y + 4 + arm);
  ctx.moveTo(x, y - 2); ctx.lineTo(x + 9, y + 4 - arm);
  ctx.moveTo(x, y + 10); ctx.lineTo(x - 6, y + 22 + leg);
  ctx.moveTo(x, y + 10); ctx.lineTo(x + 6, y + 22 - leg);
  ctx.stroke();
}

function drawStructures() {
  for (const s of state.structures) {
    s.phase += 0.03;
    ctx.fillStyle = `rgba(40,88,120,${0.35 + Math.sin(s.phase) * 0.07})`;
    ctx.fillRect(s.x, s.y, s.w, s.h);
    ctx.strokeStyle = "rgba(120,200,255,0.35)";
    ctx.strokeRect(s.x, s.y, s.w, s.h);
  }
}

function drawOrbAndWhip() {
  // Draw tether when dragging.
  if (state.draggingOrb) {
    ctx.strokeStyle = state.dragType === "ice" ? "#d7f8ff" : "#5ad9ff";
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(player.x, player.y);
    ctx.quadraticCurveTo((player.x + player.orbX) / 2, (player.y + player.orbY) / 2 - 16, player.orbX, player.orbY);
    ctx.stroke();
  }

  ctx.beginPath();
  ctx.fillStyle = "rgba(79,200,255,0.24)";
  ctx.arc(player.orbX, player.orbY, 17, 0, Math.PI * 2);
  ctx.fill();

  ctx.beginPath();
  ctx.fillStyle = state.dragType === "ice" ? "#ddf8ff" : "#7ce2ff";
  ctx.arc(player.orbX, player.orbY, 10 + Math.sin(player.orbAngle * 2) * 1.8, 0, Math.PI * 2);
  ctx.fill();
}

function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Arena grid lines.
  ctx.strokeStyle = "rgba(75,122,153,0.24)";
  for (let i = 40; i < canvas.width; i += 40) {
    ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, canvas.height); ctx.stroke();
  }

  drawStructures();
  drawOrbAndWhip();
  drawHumanoid(player.x, player.y, "#6fd7ff", player.walkAnim);

  for (const ring of state.waveRings) {
    const a = clamp(ring.life / 0.35, 0, 1);
    ctx.strokeStyle = `rgba(102,225,255,${a})`;
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.arc(ring.x, ring.y, ring.r, 0, Math.PI * 2);
    ctx.stroke();
  }

  for (const p of state.projectiles) {
    ctx.fillStyle = p.type === "ice" ? "#d9f7ff" : "#4fc8ff";
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
    ctx.fill();
  }

  for (const e of state.enemies) {
    const color = e.frozen > 0 ? "#9fe9ff" : e.hitFlash > 0 ? "#ffc4c4" : "#ff6666";
    drawHumanoid(e.x, e.y, color, e.walkAnim);
  }

  for (const p of state.particles) {
    const alpha = clamp(p.life / p.max, 0, 1);
    ctx.fillStyle = `${p.color}${Math.floor(alpha * 255).toString(16).padStart(2, "0")}`;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
    ctx.fill();
  }

  if (state.paused && !state.gameOver) {
    ctx.fillStyle = "rgba(0,0,0,0.45)";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#dff7ff";
    ctx.font = "bold 40px Arial";
    ctx.fillText("PAUSED", canvas.width / 2 - 80, canvas.height / 2);
  }
}

function updateUI() {
  ui.health.textContent = `Health: ${Math.max(0, Math.round(player.health))}`;
  ui.water.textContent = `Water: ${Math.round(player.water)}`;
  ui.score.textContent = `Score: ${state.score}`;
  ui.wave.textContent = `Wave: ${state.wave}`;
  ui.level.textContent = `Level: ${state.level}`;
  ui.pause.textContent = state.paused ? "Resume" : "Pause";
}

function resetGame() {
  Object.assign(player, {
    x: canvas.width / 2, y: canvas.height / 2, health: 100, maxHealth: 100,
    water: 100, maxWater: 100, waterRegen: 18, waveCooldown: 0, canWave: false, canIce: false,
    whipDamage: 18, launchDamage: 24, waveDamage: 18, waveRange: 110,
  });
  Object.assign(state, {
    keys: {}, draggingOrb: false, rightDown: false, enemies: [], particles: [], projectiles: [], waveRings: [],
    structures: [], score: 0, xp: 0, level: 1, wave: 1, waveTarget: 5, waveDefeated: 0,
    spawnTimer: 0.7, gameOver: false, betweenWaves: false, paused: false,
  });
  player.orbX = player.x + player.orbRadius;
  player.orbY = player.y;
  makeStructuresForWave();
  ui.gameOver.classList.add("hidden");
  ui.levelPanel.classList.add("hidden");
}

function gameLoop(time) {
  const dt = Math.min(0.033, (time - state.lastTime) / 1000 || 0);
  state.lastTime = time;

  if (!state.gameOver && !state.paused && !state.betweenWaves) {
    updatePlayer(dt);
    updateWaveRings(dt);
    updateProjectiles(dt);
    updateEnemies(dt);
    updateParticles(dt);

    if (player.health <= 0) {
      state.gameOver = true;
      ui.finalScore.textContent = `Score: ${state.score} | Wave ${state.wave}`;
      ui.gameOver.classList.remove("hidden");
    }

    if (state.rightDown) castWave();
  }

  draw();
  updateUI();
  requestAnimationFrame(gameLoop);
}

// Input handlers
window.addEventListener("keydown", (e) => {
  const key = e.key.toLowerCase();
  state.keys[key] = true;
  if (e.code === "Space") {
    e.preventDefault();
    if (state.draggingOrb && player.canIce) state.dragType = "ice";
  }
});

window.addEventListener("keyup", (e) => {
  state.keys[e.key.toLowerCase()] = false;
});

canvas.addEventListener("mousemove", (e) => {
  const rect = canvas.getBoundingClientRect();
  state.mouse.x = (e.clientX - rect.left) * (canvas.width / rect.width);
  state.mouse.y = (e.clientY - rect.top) * (canvas.height / rect.height);
});

canvas.addEventListener("mousedown", (e) => {
  if (e.button === 0) beginDragIfOnOrb();
  if (e.button === 2) {
    e.preventDefault();
    state.rightDown = true;
    castWave();
  }
});

window.addEventListener("mouseup", (e) => {
  if (e.button === 0) releaseDrag();
  if (e.button === 2) state.rightDown = false;
});

canvas.addEventListener("contextmenu", (e) => e.preventDefault());
ui.pause.addEventListener("click", () => (state.paused = !state.paused));
ui.restart.addEventListener("click", resetGame);
ui.restartTop.addEventListener("click", resetGame);

resetGame();
requestAnimationFrame(gameLoop);
