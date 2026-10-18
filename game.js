const canvas = document.querySelector("#game");
const ctx = canvas.getContext("2d");
const livesLabel = document.querySelector("#lives");
const progressLabel = document.querySelector("#progress");
const message = document.querySelector("#message");
const messageTitle = document.querySelector("#message-title");
const messageCopy = document.querySelector("#message-copy");
const restartButton = document.querySelector("#restart");

const WIDTH = canvas.width;
const HEIGHT = canvas.height;
const WORLD_WIDTH = 3720;
const GRAVITY = 1750;
const FIREBALL_SPEED = 430;
const platforms = [
  { x: 0, y: 458, width: 690 },
  { x: 790, y: 458, width: 560 },
  { x: 1450, y: 458, width: 680 },
  { x: 2220, y: 458, width: 620 },
  { x: 2930, y: 458, width: 790 },
  { x: 330, y: 365, width: 150 },
  { x: 900, y: 360, width: 170 },
  { x: 1160, y: 310, width: 135 },
  { x: 1660, y: 365, width: 150 },
  { x: 1885, y: 320, width: 140 },
  { x: 2380, y: 360, width: 160 },
  { x: 2620, y: 300, width: 140 },
  { x: 3130, y: 365, width: 160 },
];
const enemyStarts = [
  { x: 485, min: 420, max: 635 },
  { x: 1010, min: 850, max: 1250 },
  { x: 1770, min: 1510, max: 2070 },
  { x: 2485, min: 2280, max: 2780 },
  { x: 3200, min: 2970, max: 3420 },
];
const keys = new Set();
const pressed = new Set();
const stars = Array.from({ length: 70 }, (_, index) => ({
  x: (index * 137 + 41) % WORLD_WIDTH,
  y: 25 + ((index * 73) % 250),
  radius: 0.7 + ((index * 19) % 12) / 10,
  phase: index * 0.7,
}));
const petals = Array.from({ length: 18 }, (_, index) => ({
  x: (index * 173 + 53) % WIDTH,
  y: 90 + ((index * 97) % 315),
  size: 3 + (index % 3),
  phase: index * 1.4,
}));

let player;
let enemies;
let fireballs;
let cameraX = 0;
let lastTime = 0;
let elapsed = 0;
let gameState = "playing";

function resetGame() {
  player = {
    x: 72,
    y: 410,
    width: 32,
    height: 48,
    vx: 0,
    vy: 0,
    facing: 1,
    grounded: false,
    lives: 3,
    invulnerable: 0,
    attackCooldown: 0,
  };
  fireballs = [];
  enemies = enemyStarts.map((enemy, index) => ({
    ...enemy,
    y: 418,
    width: 32,
    height: 40,
    speed: index % 2 === 0 ? 72 : -68,
    alive: true,
    phase: index * 1.8,
  }));
  cameraX = 0;
  elapsed = 0;
  gameState = "playing";
  message.hidden = true;
  updateHud();
}

function updateHud() {
  const hearts = Array.from({ length: 3 }, (_, index) => index < player.lives ? "♥" : "♡").join(" ");
  livesLabel.textContent = hearts;
  livesLabel.setAttribute("aria-label", `ライフ${player.lives}`);
  progressLabel.textContent = `${Math.floor(player.x / 10)} m`;
}

function showMessage(title, copy) {
  gameState = "finished";
  messageTitle.textContent = title;
  messageCopy.textContent = copy;
  message.hidden = false;
  restartButton.focus();
}

function startAttack() {
  if (player.attackCooldown <= 0) {
    player.attackCooldown = 0.2;
    fireballs.push({
      x: player.x + (player.facing > 0 ? player.width + 12 : -12),
      y: player.y + player.height / 2,
      vx: player.facing * FIREBALL_SPEED,
      life: 1.6,
    });
  }
}

function update(delta) {
  if (gameState !== "playing") return;
  elapsed += delta;

  const left = keys.has("ArrowLeft") || keys.has("KeyA");
  const right = keys.has("ArrowRight") || keys.has("KeyD");
  const jumpPressed = pressed.has("Space") || pressed.has("ArrowUp") || pressed.has("KeyW");

  if (left !== right) {
    player.vx = (right ? 1 : -1) * 265;
    player.facing = right ? 1 : -1;
  } else {
    player.vx = 0;
  }

  if (jumpPressed && player.grounded) {
    player.vy = -650;
    player.grounded = false;
  }
  if (pressed.has("KeyZ") || pressed.has("KeyX")) startAttack();
  pressed.clear();

  const previousBottom = player.y + player.height;
  player.x = Math.max(0, Math.min(WORLD_WIDTH - player.width, player.x + player.vx * delta));
  player.vy = Math.min(player.vy + GRAVITY * delta, 900);
  player.y += player.vy * delta;
  player.grounded = false;

  if (player.vy >= 0) {
    for (const platform of platforms) {
      const crossedTop = previousBottom <= platform.y && player.y + player.height >= platform.y;
      const overlapsPlatform = player.x + player.width > platform.x && player.x < platform.x + platform.width;
      if (crossedTop && overlapsPlatform) {
        player.y = platform.y - player.height;
        player.vy = 0;
        player.grounded = true;
        break;
      }
    }
  }

  if (player.y > HEIGHT + 120) loseLife();
  player.invulnerable = Math.max(0, player.invulnerable - delta);
  player.attackCooldown = Math.max(0, player.attackCooldown - delta);

  for (const enemy of enemies) {
    if (!enemy.alive) continue;
    enemy.x += enemy.speed * delta;
    if (enemy.x < enemy.min || enemy.x + enemy.width > enemy.max) {
      enemy.speed *= -1;
      enemy.x = Math.max(enemy.min, Math.min(enemy.max - enemy.width, enemy.x));
    }

    const overlapsEnemy = enemy.alive
      && player.x < enemy.x + enemy.width
      && player.x + player.width > enemy.x
      && player.y < enemy.y + enemy.height
      && player.y + player.height > enemy.y;
    if (overlapsEnemy && player.invulnerable <= 0) {
      loseLife();
      player.vx = player.x < enemy.x ? -240 : 240;
      player.vy = -300;
    }
  }

  for (const fireball of fireballs) {
    fireball.x += fireball.vx * delta;
    fireball.life -= delta;
    for (const enemy of enemies) {
      const overlapsEnemy = enemy.alive
        && fireball.x - 11 < enemy.x + enemy.width
        && fireball.x + 11 > enemy.x
        && fireball.y - 11 < enemy.y + enemy.height
        && fireball.y + 11 > enemy.y;
      if (overlapsEnemy) {
        enemy.alive = false;
        fireball.life = 0;
        break;
      }
    }
  }
  fireballs = fireballs.filter((fireball) => fireball.life > 0 && fireball.x >= 0 && fireball.x <= WORLD_WIDTH);

  const targetCamera = Math.max(0, Math.min(WORLD_WIDTH - WIDTH, player.x - WIDTH * 0.38));
  cameraX += (targetCamera - cameraX) * Math.min(1, delta * 5);

  if (player.x >= WORLD_WIDTH - 170) {
    showMessage("ゴール！", "光の塔にたどり着いた！");
  }
  updateHud();
}

function loseLife() {
  player.lives -= 1;
  player.invulnerable = 1.2;
  if (player.lives <= 0) {
    player.lives = 0;
    updateHud();
    showMessage("ゲームオーバー", "もう一度挑戦して、光の塔を目指そう。");
  } else {
    player.x = Math.max(0, player.x - 90);
    player.y = 410;
    player.vy = 0;
  }
}

function drawBackground() {
  const sky = ctx.createLinearGradient(0, 0, 0, HEIGHT);
  sky.addColorStop(0, "#252b4b");
  sky.addColorStop(0.58, "#786078");
  sky.addColorStop(1, "#e9a17e");
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  const moonX = 745 - cameraX * 0.08;
  const moonGlow = ctx.createRadialGradient(moonX, 132, 8, moonX, 132, 122);
  moonGlow.addColorStop(0, "rgba(255, 231, 193, 0.3)");
  moonGlow.addColorStop(1, "rgba(255, 231, 193, 0)");
  ctx.fillStyle = moonGlow;
  ctx.fillRect(moonX - 122, 10, 244, 244);
  ctx.fillStyle = "#ffe8c3";
  ctx.beginPath();
  ctx.arc(moonX, 132, 27, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "rgba(204, 145, 131, 0.2)";
  ctx.beginPath();
  ctx.arc(moonX - 8, 123, 6, 0, Math.PI * 2);
  ctx.arc(moonX + 9, 140, 4, 0, Math.PI * 2);
  ctx.fill();

  for (const star of stars) {
    const x = ((star.x - cameraX * 0.12) % WIDTH + WIDTH) % WIDTH;
    const twinkle = 0.38 + Math.sin(elapsed * 1.7 + star.phase) * 0.22;
    ctx.globalAlpha = twinkle;
    ctx.fillStyle = "#fff0d5";
    ctx.beginPath();
    ctx.arc(x, star.y, star.radius, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  drawRidge("#75617d", 355, 0.16, 170, 0.005);
  drawRidge("#443b5e", 412, 0.28, 130, 0.007);

  for (let index = -1; index < 3; index += 1) {
    const pagodaX = index * 430 + 215 - cameraX * 0.2;
    drawPagoda(((pagodaX % 1290) + 1290) % 1290 - 150, 383, 0.85);
  }

  const mist = ctx.createLinearGradient(0, 350, 0, 458);
  mist.addColorStop(0, "rgba(255, 211, 189, 0)");
  mist.addColorStop(1, "rgba(255, 211, 189, 0.16)");
  ctx.fillStyle = mist;
  ctx.fillRect(0, 350, WIDTH, 108);

  for (const petal of petals) {
    const x = (petal.x + Math.sin(elapsed * 0.6 + petal.phase) * 22 - elapsed * 9 + WIDTH) % WIDTH;
    const y = (petal.y + elapsed * 13 + Math.sin(elapsed + petal.phase) * 9) % 440;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(elapsed * 0.8 + petal.phase);
    ctx.fillStyle = "rgba(255, 190, 190, 0.78)";
    ctx.beginPath();
    ctx.ellipse(0, 0, petal.size, petal.size * 0.55, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

function drawPagoda(x, baseline, scale) {
  ctx.save();
  ctx.translate(x, baseline);
  ctx.scale(scale, scale);
  ctx.fillStyle = "#37334f";
  ctx.fillRect(28, -58, 54, 58);
  ctx.fillRect(35, -91, 40, 33);
  ctx.fillRect(41, -119, 28, 28);
  for (const [y, halfWidth] of [[-119, 25], [-91, 34], [-58, 46]]) {
    ctx.beginPath();
    ctx.moveTo(55 - halfWidth, y + 8);
    ctx.lineTo(55, y);
    ctx.lineTo(55 + halfWidth, y + 8);
    ctx.lineTo(55 + halfWidth - 7, y + 8);
    ctx.lineTo(55, y + 4);
    ctx.lineTo(55 - halfWidth + 7, y + 8);
    ctx.closePath();
    ctx.fill();
  }
  ctx.fillRect(53, -139, 4, 20);
  ctx.beginPath();
  ctx.moveTo(50, -139);
  ctx.lineTo(55, -148);
  ctx.lineTo(60, -139);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function drawRidge(color, baseline, parallax, height, frequency) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(0, HEIGHT);
  for (let x = -10; x <= WIDTH + 10; x += 12) {
    const worldX = x + cameraX * parallax;
    const y = baseline - (Math.sin(worldX * frequency) * 0.5 + 0.5) * height
      - Math.cos(worldX * frequency * 0.43) * height * 0.28;
    ctx.lineTo(x, y);
  }
  ctx.lineTo(WIDTH, HEIGHT);
  ctx.closePath();
  ctx.fill();
}

function drawPlatforms() {
  for (const platform of platforms) {
    const x = platform.x - cameraX;
    if (x > WIDTH || x + platform.width < 0) continue;
    const depth = platform.y >= 450 ? HEIGHT - platform.y : 14;
    ctx.fillStyle = "#514653";
    ctx.fillRect(x, platform.y, platform.width, depth);
    ctx.fillStyle = "#bd695f";
    ctx.fillRect(x, platform.y, platform.width, 4);
    ctx.fillStyle = "#e2b582";
    ctx.fillRect(x, platform.y + 4, platform.width, 2);
    ctx.fillStyle = "rgba(37, 30, 47, 0.4)";
    ctx.fillRect(x, platform.y + 6, platform.width, 2);
    ctx.fillStyle = "rgba(221, 190, 156, 0.22)";
    for (let stone = 0; platform.y >= 450 && stone < platform.width; stone += 58) {
      const detailX = x + stone + 13;
      ctx.fillRect(detailX, platform.y + 19 + (stone % 3) * 13, 20, 2);
      ctx.fillRect(detailX + 7, platform.y + 25 + (stone % 3) * 13, 2, 5);
    }
    if (platform.y < 450) {
      ctx.fillStyle = "rgba(228, 190, 147, 0.34)";
      ctx.fillRect(x + 8, platform.y + 10, Math.max(0, platform.width - 16), 1);
    }
  }
}

function drawGoal() {
  const x = WORLD_WIDTH - 105 - cameraX;
  const pulse = 0.72 + Math.sin(elapsed * 3) * 0.12;
  const glow = ctx.createRadialGradient(x, 380, 3, x, 380, 95);
  glow.addColorStop(0, `rgba(255, 213, 153, ${0.42 * pulse})`);
  glow.addColorStop(1, "rgba(255, 213, 153, 0)");
  ctx.fillStyle = glow;
  ctx.fillRect(x - 95, 285, 190, 190);
  ctx.fillStyle = "#6c3442";
  ctx.fillRect(x - 38, 350, 9, 108);
  ctx.fillRect(x + 29, 350, 9, 108);
  ctx.fillStyle = "#a7444d";
  ctx.fillRect(x - 47, 345, 94, 12);
  ctx.fillRect(x - 39, 361, 78, 6);
  ctx.fillStyle = "#d78a63";
  ctx.fillRect(x - 34, 350, 3, 108);
  ctx.fillRect(x + 31, 350, 3, 108);
  ctx.fillStyle = "#f3d49e";
  ctx.beginPath();
  ctx.moveTo(x - 51, 344);
  ctx.lineTo(x - 42, 338);
  ctx.lineTo(x + 42, 338);
  ctx.lineTo(x + 51, 344);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = "#f3d49e";
  ctx.font = "11px 'Noto Sans JP', sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("光の鳥居", x, 420);
  ctx.textAlign = "start";
}

function drawPlayer() {
  if (player.invulnerable > 0 && Math.floor(elapsed * 14) % 2 === 0) return;
  const x = player.x - cameraX;
  const y = player.y;

  ctx.fillStyle = "rgba(37, 27, 43, 0.3)";
  ctx.beginPath();
  ctx.ellipse(x + 16, y + 48, 16, 4, 0, 0, Math.PI * 2);
  ctx.fill();

  const run = Math.abs(player.vx) > 0 ? Math.sin(elapsed * 17) * 3 : 0;
  ctx.fillStyle = "#30354c";
  ctx.fillRect(x + 4, y + 17, 25, 26);
  ctx.fillStyle = "#984a50";
  ctx.fillRect(x + 4, y + 18, 25, 9);
  ctx.fillStyle = "#d69a76";
  ctx.fillRect(x + 8, y + 19, 3, 23);
  ctx.fillStyle = "#e9bd91";
  ctx.fillRect(x + 8, y + 3, 19, 18);
  ctx.fillStyle = "#373448";
  ctx.fillRect(x + 3, y + 1, 27, 5);
  ctx.fillRect(x + 7, y - 2, 20, 4);
  ctx.fillStyle = "#e9bd91";
  ctx.fillRect(x + 2, y + 7, 7, 8);
  ctx.fillStyle = "#373448";
  ctx.fillRect(x + 5, y + 40, 9, 8 + run);
  ctx.fillRect(x + 19, y + 40, 9, 8 - run);
  ctx.fillStyle = "#d69a76";
  ctx.fillRect(x + 4, y + 46 + run, 12, 2);
  ctx.fillRect(x + 18, y + 46 - run, 12, 2);
  ctx.fillStyle = "#3e354a";
  ctx.fillRect(x + (player.facing > 0 ? 21 : 10), y + 9, 3, 3);
}

function drawFireballs() {
  for (const fireball of fireballs) {
    const x = fireball.x - cameraX;
    const y = fireball.y;
    const flicker = Math.sin(elapsed * 36 + fireball.x) * 2;
    const direction = Math.sign(fireball.vx);
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(direction, 1);
    ctx.shadowColor = "#ff6b32";
    ctx.shadowBlur = 18;
    ctx.fillStyle = "#f25b32";
    ctx.beginPath();
    ctx.moveTo(-9, -6);
    ctx.quadraticCurveTo(-19, -13 - flicker, -25, -3);
    ctx.quadraticCurveTo(-19, 0, -25, 5 + flicker);
    ctx.quadraticCurveTo(-17, 13, -8, 7);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "#ff9e3d";
    ctx.beginPath();
    ctx.arc(0, 0, 11, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.fillStyle = "#fff0a6";
    ctx.beginPath();
    ctx.arc(2, -2, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

function drawEnemies() {
  for (const enemy of enemies) {
    if (!enemy.alive) continue;
    const x = enemy.x - cameraX;
    const bounce = Math.sin(elapsed * 5 + enemy.phase) * 2;
    ctx.fillStyle = "rgba(37, 27, 43, 0.28)";
    ctx.beginPath();
    ctx.ellipse(x + 16, enemy.y + 40, 17, 4, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#51405a";
    ctx.beginPath();
    ctx.moveTo(x + 3, enemy.y + 14 + bounce);
    ctx.lineTo(x + 5, enemy.y + 7 + bounce);
    ctx.lineTo(x + 12, enemy.y + 12 + bounce);
    ctx.lineTo(x + 20, enemy.y + 12 + bounce);
    ctx.lineTo(x + 27, enemy.y + 7 + bounce);
    ctx.lineTo(x + 29, enemy.y + 14 + bounce);
    ctx.lineTo(x + 32, enemy.y + 34 + bounce);
    ctx.quadraticCurveTo(x + 31, enemy.y + 40 + bounce, x + 24, enemy.y + 40 + bounce);
    ctx.lineTo(x + 8, enemy.y + 40 + bounce);
    ctx.quadraticCurveTo(x + 1, enemy.y + 40 + bounce, x, enemy.y + 34 + bounce);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "#f0bc82";
    ctx.fillRect(x + 7, enemy.y + 17 + bounce, 5, 4);
    ctx.fillRect(x + 20, enemy.y + 17 + bounce, 5, 4);
    ctx.fillStyle = "#9d4b50";
    ctx.fillRect(x + 11, enemy.y + 29 + bounce, 10, 3);
    ctx.fillStyle = "#806479";
    ctx.fillRect(x + 4, enemy.y + 37 + bounce, 9, 3);
    ctx.fillRect(x + 20, enemy.y + 37 + bounce, 9, 3);
  }
}

function draw() {
  drawBackground();
  drawPlatforms();
  drawGoal();
  drawEnemies();
  drawPlayer();
  drawFireballs();
}

function frame(timestamp) {
  const delta = lastTime === 0 ? 0 : Math.min((timestamp - lastTime) / 1000, 0.033);
  lastTime = timestamp;
  update(delta);
  draw();
  requestAnimationFrame(frame);
}

window.addEventListener("keydown", (event) => {
  if (["ArrowLeft", "ArrowRight", "ArrowUp", "Space"].includes(event.code)) event.preventDefault();
  if (!keys.has(event.code)) pressed.add(event.code);
  keys.add(event.code);
});

window.addEventListener("keyup", (event) => {
  keys.delete(event.code);
});

window.addEventListener("blur", () => {
  keys.clear();
  pressed.clear();
});

document.querySelectorAll(".touch-button").forEach((button) => {
  const key = button.dataset.key;
  button.addEventListener("pointerdown", (event) => {
    event.preventDefault();
    button.setPointerCapture(event.pointerId);
    if (!keys.has(key)) pressed.add(key);
    keys.add(key);
  });
  const release = () => keys.delete(key);
  button.addEventListener("pointerup", release);
  button.addEventListener("pointercancel", release);
  button.addEventListener("lostpointercapture", release);
});

restartButton.addEventListener("click", resetGame);

resetGame();
requestAnimationFrame(frame);
