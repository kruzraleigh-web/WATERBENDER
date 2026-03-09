// Waterbender Arena
// Beginner-friendly 2D canvas game using plain JavaScript.

const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");
const ui = {
  health: document.getElementById("healthText"),
  water: document.getElementById("waterText"),
  score: document.getElementById("scoreText"),
  panel: document.getElementById("gameOverPanel"),
  finalScore: document.getElementById("finalScore"),
  restart: document.getElementById("restartBtn"),
};

const state = {
  keys: {},
  mouse: { x: canvas.width / 2, y: canvas.height / 2, down: false },
  rightDown: false,
  projectiles: [],
  particles: [],
  enemies: [],
  score: 0,
  gameOver: false,
  spawnTimer: 0,
  spawnEvery: 1.2,
  lastTime: 0,
};

const player = {
  x: canvas.width / 2,
  y: canvas.height / 2,
  r: 16,
  speed: 260,
  health: 100,
  maxHealth: 100,
  water: 100,
  maxWater: 100,
  waterRegen: 18,
  orbAngle: 0,
  orbRadius: 32,
  whipCost: 8,
  waveCost: 22,
  iceCost: 35,
  waveCooldown: 0,
  iceCooldown: 0,
  walkAnim: 0,
};

function rand(min, max) {
  return Math.random() * (max - min) + min;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function dist(ax, ay, bx, by) {
  return Math.hypot(ax - bx, ay - by);
}

function spawnEnemy() {
  const side = Math.floor(rand(0, 4));
  let x = 0;
  let y = 0;
  if (side === 0) {
    x = rand(0, canvas.width);
    y = -20;
  } else if (side === 1) {
    x = canvas.width + 20;
    y = rand(0, canvas.height);
  } else if (side === 2) {
    x = rand(0, canvas.width);
    y = canvas.height + 20;
  } else {
    x = -20;
    y = rand(0, canvas.height);
  }
  state.enemies.push({
    x,
    y,
    r: 14,
    hp: 40,
    speed: rand(65, 105),
    frozen: 0,
    hitFlash: 0,
    walkAnim: rand(0, Math.PI * 2),
  });
}

function addParticles(x, y, color, count, speed = 120) {
  for (let i = 0; i < count; i++) {
    const angle = rand(0, Math.PI * 2);
    const s = rand(speed * 0.4, speed);
    state.particles.push({
      x,
      y,
      vx: Math.cos(angle) * s,
      vy: Math.sin(angle) * s,
      life: rand(0.2, 0.6),
      maxLife: 0.6,
      color,
      size: rand(2, 5),
    });
  }
}

function shootWhip() {
  if (player.water < player.whipCost || state.gameOver) return;
  player.water -= player.whipCost;
  const angle = Math.atan2(state.mouse.y - player.y, state.mouse.x - player.x);
  state.projectiles.push({
    x: player.x,
    y: player.y,
    vx: Math.cos(angle) * 520,
    vy: Math.sin(angle) * 520,
    r: 6,
    damage: 20,
    life: 1.1,
    type: "whip",
  });
  addParticles(player.x, player.y, "#8ce8ff", 9, 170);
}

function waterWave() {
  if (player.waveCooldown > 0 || player.water < player.waveCost || state.gameOver) return;
  player.waveCooldown = 0.8;
  player.water -= player.waveCost;
  const range = 95;
  for (const e of state.enemies) {
    const d = dist(player.x, player.y, e.x, e.y);
    if (d < range) {
      const push = (range - d) * 5;
      const nx = (e.x - player.x) / (d || 1);
      const ny = (e.y - player.y) / (d || 1);
      e.x += nx * push;
      e.y += ny * push;
      e.hp -= 16;
      e.hitFlash = 0.12;
    }
  }
  addParticles(player.x, player.y, "#4fc8ff", 30, 220);
}

function iceBlast() {
  if (player.iceCooldown > 0 || player.water < player.iceCost || state.gameOver) return;
  player.iceCooldown = 2.4;
  player.water -= player.iceCost;
  const angle = Math.atan2(state.mouse.y - player.y, state.mouse.x - player.x);
  state.projectiles.push({
    x: player.x,
    y: player.y,
    vx: Math.cos(angle) * 380,
    vy: Math.sin(angle) * 380,
    r: 9,
    damage: 10,
    life: 1.2,
    type: "ice",
  });
  addParticles(player.x, player.y, "#d3f4ff", 14, 140);
}

function updatePlayer(dt) {
  let mx = 0;
  let my = 0;
  if (state.keys["w"]) my -= 1;
  if (state.keys["s"]) my += 1;
  if (state.keys["a"]) mx -= 1;
  if (state.keys["d"]) mx += 1;
  const len = Math.hypot(mx, my) || 1;
  player.x += (mx / len) * player.speed * dt;
  player.y += (my / len) * player.speed * dt;
  player.x = clamp(player.x, player.r, canvas.width - player.r);
  player.y = clamp(player.y, player.r, canvas.height - player.r);

  player.water = clamp(player.water + player.waterRegen * dt, 0, player.maxWater);
  player.waveCooldown = Math.max(0, player.waveCooldown - dt);
  player.iceCooldown = Math.max(0, player.iceCooldown - dt);
  player.walkAnim += dt * 8;
  player.orbAngle += dt * 2.8;

  if (state.rightDown) waterWave();
}

function updateProjectiles(dt) {
  for (let i = state.projectiles.length - 1; i >= 0; i--) {
    const p = state.projectiles[i];
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.life -= dt;

    if (p.type === "whip") addParticles(p.x, p.y, "#4fc8ff", 1, 50);

    for (const e of state.enemies) {
      if (dist(p.x, p.y, e.x, e.y) < p.r + e.r) {
        e.hp -= p.damage;
        e.hitFlash = 0.1;
        if (p.type === "ice") e.frozen = 2;
        addParticles(e.x, e.y, p.type === "ice" ? "#d7fbff" : "#57d8ff", 12, 130);
        p.life = 0;
        break;
      }
    }

    if (
      p.life <= 0 ||
      p.x < -30 ||
      p.x > canvas.width + 30 ||
      p.y < -30 ||
      p.y > canvas.height + 30
    ) {
      state.projectiles.splice(i, 1);
    }
  }
}

function updateEnemies(dt) {
  state.spawnTimer -= dt;
  if (state.spawnTimer <= 0) {
    spawnEnemy();
    state.spawnTimer = Math.max(0.45, state.spawnEvery - state.score * 0.008);
  }

  for (let i = state.enemies.length - 1; i >= 0; i--) {
    const e = state.enemies[i];
    const dx = player.x - e.x;
    const dy = player.y - e.y;
    const d = Math.hypot(dx, dy) || 1;

    if (e.frozen > 0) {
      e.frozen -= dt;
    } else {
      e.x += (dx / d) * e.speed * dt;
      e.y += (dy / d) * e.speed * dt;
      e.walkAnim += dt * 7;
    }

    e.hitFlash = Math.max(0, e.hitFlash - dt);

    if (d < player.r + e.r) {
      player.health -= 24 * dt;
      addParticles(player.x, player.y, "#ff8ea0", 1, 45);
    }

    if (e.hp <= 0) {
      state.score += 10;
      addParticles(e.x, e.y, "#9be9ff", 18, 180);
      state.enemies.splice(i, 1);
    }
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

function drawHumanoid(x, y, color, walkPhase) {
  const legSwing = Math.sin(walkPhase) * 3;
  const armSwing = Math.cos(walkPhase) * 3;

  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(x, y - 14, 7, 0, Math.PI * 2);
  ctx.fill();

  ctx.lineWidth = 4;
  ctx.strokeStyle = color;
  ctx.lineCap = "round";

  ctx.beginPath();
  ctx.moveTo(x, y - 7);
  ctx.lineTo(x, y + 10);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(x, y - 2);
  ctx.lineTo(x - 9, y + 4 + armSwing);
  ctx.moveTo(x, y - 2);
  ctx.lineTo(x + 9, y + 4 - armSwing);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(x, y + 10);
  ctx.lineTo(x - 6, y + 22 + legSwing);
  ctx.moveTo(x, y + 10);
  ctx.lineTo(x + 6, y + 22 - legSwing);
  ctx.stroke();
}

function drawOrb() {
  const ox = player.x + Math.cos(player.orbAngle) * player.orbRadius;
  const oy = player.y + Math.sin(player.orbAngle) * player.orbRadius;
  const radius = 10 + Math.sin(player.orbAngle * 2) * 2;

  ctx.beginPath();
  ctx.fillStyle = "rgba(79,200,255,0.26)";
  ctx.arc(ox, oy, radius + 7, 0, Math.PI * 2);
  ctx.fill();

  ctx.beginPath();
  ctx.fillStyle = "#7de1ff";
  ctx.arc(ox, oy, radius, 0, Math.PI * 2);
  ctx.fill();
}

function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Arena details
  ctx.strokeStyle = "rgba(75,122,153,0.35)";
  for (let i = 40; i < canvas.width; i += 40) {
    ctx.beginPath();
    ctx.moveTo(i, 0);
    ctx.lineTo(i, canvas.height);
    ctx.stroke();
  }

  drawOrb();
  drawHumanoid(player.x, player.y, "#6fd7ff", player.walkAnim);

  for (const p of state.projectiles) {
    ctx.beginPath();
    ctx.fillStyle = p.type === "ice" ? "#d3f7ff" : "#4fc8ff";
    ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
    ctx.fill();
  }

  for (const e of state.enemies) {
    const color = e.frozen > 0 ? "#9be7ff" : e.hitFlash > 0 ? "#ffc4c4" : "#ff6a6a";
    drawHumanoid(e.x, e.y, color, e.walkAnim);
    // tiny health bar
    ctx.fillStyle = "rgba(0,0,0,0.5)";
    ctx.fillRect(e.x - 14, e.y - 28, 28, 4);
    ctx.fillStyle = "#7effa1";
    ctx.fillRect(e.x - 14, e.y - 28, (clamp(e.hp, 0, 40) / 40) * 28, 4);
  }

  for (const p of state.particles) {
    const alpha = p.life / p.maxLife;
    ctx.fillStyle = `${p.color}${Math.floor(alpha * 255)
      .toString(16)
      .padStart(2, "0")}`;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
    ctx.fill();
  }
}

function updateUI() {
  ui.health.textContent = `Health: ${Math.max(0, Math.round(player.health))}`;
  ui.water.textContent = `Water: ${Math.round(player.water)}`;
  ui.score.textContent = `Score: ${state.score}`;
}

function resetGame() {
  Object.assign(player, {
    x: canvas.width / 2,
    y: canvas.height / 2,
    health: 100,
    water: 100,
    waveCooldown: 0,
    iceCooldown: 0,
    walkAnim: 0,
  });
  Object.assign(state, {
    projectiles: [],
    particles: [],
    enemies: [],
    score: 0,
    gameOver: false,
    spawnTimer: 0.5,
    spawnEvery: 1.2,
  });
  ui.panel.classList.add("hidden");
}

function gameLoop(time) {
  const dt = Math.min(0.033, (time - state.lastTime) / 1000 || 0);
  state.lastTime = time;

  if (!state.gameOver) {
    updatePlayer(dt);
    updateProjectiles(dt);
    updateEnemies(dt);
    updateParticles(dt);

    if (player.health <= 0) {
      state.gameOver = true;
      ui.finalScore.textContent = `Score: ${state.score}`;
      ui.panel.classList.remove("hidden");
    }
  }

  draw();
  updateUI();
  requestAnimationFrame(gameLoop);
}

// Input events
window.addEventListener("keydown", (e) => {
  const key = e.key.toLowerCase();
  state.keys[key] = true;
  if (e.code === "Space") {
    e.preventDefault();
    iceBlast();
  }
});

window.addEventListener("keyup", (e) => {
  state.keys[e.key.toLowerCase()] = false;
});

canvas.addEventListener("mousemove", (e) => {
  const rect = canvas.getBoundingClientRect();
  const sx = canvas.width / rect.width;
  const sy = canvas.height / rect.height;
  state.mouse.x = (e.clientX - rect.left) * sx;
  state.mouse.y = (e.clientY - rect.top) * sy;
});

canvas.addEventListener("mousedown", (e) => {
  if (e.button === 0) shootWhip();
  if (e.button === 2) {
    state.rightDown = true;
    waterWave();
  }
});

window.addEventListener("mouseup", (e) => {
  if (e.button === 2) state.rightDown = false;
});

canvas.addEventListener("contextmenu", (e) => e.preventDefault());
ui.restart.addEventListener("click", resetGame);

resetGame();
requestAnimationFrame(gameLoop);
