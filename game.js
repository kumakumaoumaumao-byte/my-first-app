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

let player;
let enemies;
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
    attackTime: 0,
    hitEnemies: new Set(),
  };
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
  if (player.attackTime <= 0) {
    player.attackTime = 0.2;
    player.hitEnemies.clear();
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
  player.attackTime = Math.max(0, player.attackTime - delta);

  for (const enemy of enemies) {
    if (!enemy.alive) continue;
    enemy.x += enemy.speed * delta;
    if (enemy.x < enemy.min || enemy.x + enemy.width > enemy.max) {
      enemy.speed *= -1;
      enemy.x = Math.max(enemy.min, Math.min(enemy.max - enemy.width, enemy.x));
    }

    const attackX = player.facing > 0 ? player.x + player.width - 2 : player.x - 40;
    const attackHitsEnemy = player.attackTime > 0
      && attackX < enemy.x + enemy.width
      && attackX + 42 > enemy.x
      && player.y + 8 < enemy.y + enemy.height
      && player.y + player.height - 4 > enemy.y;
    if (attackHitsEnemy && !player.hitEnemies.has(enemy)) {
      enemy.alive = false;
      player.hitEnemies.add(enemy);
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
  sky.addColorStop(0, "#101a38");
  sky.addColorStop(0.58, "#293f68");
  sky.addColorStop(1, "#a85e70");
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  const moonX = 745 - cameraX * 0.08;
  const moonGlow = ctx.createRadialGradient(moonX, 132, 8, moonX, 132, 122);
  moonGlow.addColorStop(0, "rgba(167, 224, 255, 0.28)");
  moonGlow.addColorStop(1, "rgba(167, 224, 255, 0)");
  ctx.fillStyle = moonGlow;
  ctx.fillRect(moonX - 122, 10, 244, 244);
  ctx.fillStyle = "#d9f2ff";
  ctx.beginPath();
  ctx.arc(moonX, 132, 27, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "rgba(123, 177, 215, 0.25)";
  ctx.beginPath();
  ctx.arc(moonX - 8, 123, 6, 0, Math.PI * 2);
  ctx.arc(moonX + 9, 140, 4, 0, Math.PI * 2);
  ctx.fill();

  for (const star of stars) {
    const x = ((star.x - cameraX * 0.12) % WIDTH + WIDTH) % WIDTH;
    const twinkle = 0.38 + Math.sin(elapsed * 1.7 + star.phase) * 0.22;
    ctx.globalAlpha = twinkle;
    ctx.fillStyle = "#d9efff";
    ctx.beginPath();
    ctx.arc(x, star.y, star.radius, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  drawRidge("#34476d", 355, 0.16, 170, 0.005);
  drawRidge("#202f51", 412, 0.28, 130, 0.007);

  const mist = ctx.createLinearGradient(0, 350, 0, 458);
  mist.addColorStop(0, "rgba(173, 125, 166, 0)");
  mist.addColorStop(1, "rgba(173, 125, 166, 0.13)");
  ctx.fillStyle = mist;
  ctx.fillRect(0, 350, WIDTH, 108);
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
    const stone = ctx.createLinearGradient(0, platform.y, 0, platform.y + depth);
    stone.addColorStop(0, "#283958");
    stone.addColorStop(1, "#17243d");
    ctx.fillStyle = stone;
    ctx.fillRect(x, platform.y, platform.width, depth);
    ctx.fillStyle = "#75e0d0";
    ctx.fillRect(x, platform.y, platform.width, 4);
    ctx.fillStyle = "rgba(180, 255, 237, 0.52)";
    ctx.fillRect(x, platform.y + 4, platform.width, 2);
    ctx.fillStyle = "rgba(7, 17, 37, 0.42)";
    ctx.fillRect(x, platform.y + 6, platform.width, 2);
    ctx.fillStyle = "rgba(151, 185, 219, 0.2)";
    for (let stone = 0; platform.y >= 450 && stone < platform.width; stone += 58) {
      const detailX = x + stone + 13;
      ctx.fillRect(detailX, platform.y + 19 + (stone % 3) * 13, 20, 2);
      ctx.fillRect(detailX + 7, platform.y + 25 + (stone % 3) * 13, 2, 5);
    }
    if (platform.y < 450) {
      ctx.fillStyle = "rgba(165, 233, 231, 0.3)";
      ctx.fillRect(x + 8, platform.y + 10, Math.max(0, platform.width - 16), 1);
    }
  }
}

function drawGoal() {
  const x = WORLD_WIDTH - 105 - cameraX;
  const pulse = 0.72 + Math.sin(elapsed * 3) * 0.12;
  const glow = ctx.createRadialGradient(x, 368, 3, x, 368, 85);
  glow.addColorStop(0, `rgba(255, 226, 147, ${0.48 * pulse})`);
  glow.addColorStop(1, "rgba(255, 226, 147, 0)");
  ctx.fillStyle = glow;
  ctx.fillRect(x - 85, 283, 170, 170);
  ctx.fillStyle = "#ffdf98";
  ctx.fillRect(x - 3, 355, 6, 103);
  ctx.beginPath();
  ctx.moveTo(x + 3, 357);
  ctx.lineTo(x + 39, 369);
  ctx.lineTo(x + 3, 381);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = "rgba(255, 238, 200, 0.7)";
  ctx.font = "11px Manrope, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("LIGHT TOWER", x, 411);
  ctx.textAlign = "start";
}

function drawPlayer() {
  if (player.invulnerable > 0 && Math.floor(elapsed * 14) % 2 === 0) return;
  const x = player.x - cameraX;
  const y = player.y;

  ctx.fillStyle = "rgba(8, 16, 35, 0.35)";
  ctx.beginPath();
  ctx.ellipse(x + 16, y + 48, 16, 4, 0, 0, Math.PI * 2);
  ctx.fill();

  if (player.attackTime > 0) {
    ctx.strokeStyle = "rgba(127, 245, 231, 0.92)";
    ctx.lineWidth = 5;
    ctx.shadowColor = "#69e8df";
    ctx.shadowBlur = 16;
    ctx.beginPath();
    const centerX = x + (player.facing > 0 ? 43 : -11);
    ctx.arc(centerX, y + 27, 25, player.facing > 0 ? -1.05 : Math.PI + 0.05, player.facing > 0 ? 1.05 : Math.PI * 2 - 0.05);
    ctx.stroke();
    ctx.shadowBlur = 0;
  }

  const run = Math.abs(player.vx) > 0 ? Math.sin(elapsed * 17) * 3 : 0;
  const body = ctx.createLinearGradient(x + 4, y + 17, x + 29, y + 43);
  body.addColorStop(0, "#5678bd");
  body.addColorStop(1, "#263b71");
  ctx.fillStyle = body;
  ctx.fillRect(x + 4, y + 17, 25, 26);
  ctx.fillStyle = "#18294e";
  ctx.fillRect(x + 3, y + 20, 4, 21);
  ctx.fillStyle = "#91f1df";
  ctx.fillRect(x + 5, y + 20, 27, 4);
  ctx.fillStyle = "#d7efff";
  ctx.fillRect(x + 8, y + 25, 18, 2);
  ctx.fillStyle = "#e9ad78";
  ctx.fillRect(x + 8, y + 3, 19, 18);
  ctx.fillStyle = "#344066";
  ctx.fillRect(x + 6, y, 23, 8);
  ctx.fillStyle = "#53648f";
  ctx.fillRect(x + 10, y - 3, 16, 4);
  ctx.fillStyle = "#e9ad78";
  ctx.fillRect(x + 2, y + 7, 7, 8);
  ctx.fillStyle = "#20335f";
  ctx.fillRect(x + 5, y + 40, 9, 8 + run);
  ctx.fillRect(x + 19, y + 40, 9, 8 - run);
  ctx.fillStyle = "#85e9df";
  ctx.fillRect(x + 4, y + 46 + run, 12, 2);
  ctx.fillRect(x + 18, y + 46 - run, 12, 2);
  ctx.fillStyle = "#f7f4d7";
  ctx.fillRect(x + (player.facing > 0 ? 21 : 10), y + 9, 3, 3);
  ctx.fillStyle = "#f3a974";
  ctx.fillRect(x + (player.facing > 0 ? 24 : 8), y + 14, 4, 2);
}

function drawEnemies() {
  for (const enemy of enemies) {
    if (!enemy.alive) continue;
    const x = enemy.x - cameraX;
    const bounce = Math.sin(elapsed * 5 + enemy.phase) * 2;
    ctx.fillStyle = "rgba(8, 16, 35, 0.32)";
    ctx.beginPath();
    ctx.ellipse(x + 16, enemy.y + 40, 17, 4, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowColor = "rgba(191, 113, 255, 0.48)";
    ctx.shadowBlur = 14;
    const enemyBody = ctx.createLinearGradient(x, enemy.y + bounce, x + 32, enemy.y + 40 + bounce);
    enemyBody.addColorStop(0, "#9a69d4");
    enemyBody.addColorStop(1, "#493c86");
    ctx.fillStyle = enemyBody;
    ctx.beginPath();
    ctx.roundRect(x, enemy.y + bounce, enemy.width, enemy.height, [12, 12, 5, 5]);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = "rgba(221, 190, 255, 0.7)";
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.fillStyle = "#fff0c2";
    ctx.fillRect(x + 7, enemy.y + 13 + bounce, 5, 5);
    ctx.fillRect(x + 20, enemy.y + 13 + bounce, 5, 5);
    ctx.fillStyle = "#f48da9";
    ctx.fillRect(x + 9, enemy.y + 15 + bounce, 3, 3);
    ctx.fillRect(x + 22, enemy.y + 15 + bounce, 3, 3);
    ctx.fillStyle = "#372f68";
    ctx.fillRect(x + 11, enemy.y + 29 + bounce, 10, 3);
    ctx.fillStyle = "#b897e8";
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
