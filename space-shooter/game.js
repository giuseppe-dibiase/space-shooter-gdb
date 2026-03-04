// ─────────────────────────────────────────────
//  Retro 2D Space Shooter — Phaser 3
// ─────────────────────────────────────────────

// ── BootScene ────────────────────────────────
class BootScene extends Phaser.Scene {
  constructor() { super('BootScene'); }

  preload() {
    // ── Loading bar ──────────────────────────
    const { width, height } = this.scale;
    const barW  = Math.min(360, width - 40);
    const barBg = this.add.rectangle(width / 2, height / 2, barW, 20, 0x333333);
    const bar   = this.add.rectangle(width / 2 - barW / 2, height / 2, 0, 20, 0x44aaff);
    bar.setOrigin(0, 0.5);

    this.load.on('progress', (v) => { bar.width = barW * v; });

    // ── Images ──────────────────────────────
    this.load.image('bg',         'assets/images/darkPurple.png');
    this.load.image('player',     'assets/images/playerShip1_blue.png');
    this.load.image('enemy1',     'assets/images/enemyBlack1.png');
    this.load.image('enemy2',     'assets/images/enemyBlack2.png');
    this.load.image('enemy3',     'assets/images/enemyBlack3.png');
    this.load.image('laserBlue',  'assets/images/laserBlue01.png');
    this.load.image('laserRed',   'assets/images/laserRed01.png');
    this.load.image('boss',         'assets/images/boss.png');
    this.load.image('powerupSpeed', 'assets/images/powerupSpeed.png');
    this.load.image('powerupPower', 'assets/images/powerupPower.png');

    // Explosion spritesheet — 9 frames, each 64×64 px
    this.load.spritesheet('explosion', 'assets/images/explosion.png', {
      frameWidth: 64, frameHeight: 64
    });
  }

  create() {
    this.scene.start('GameScene');
  }
}

// ── GameScene ─────────────────────────────────
class GameScene extends Phaser.Scene {
  constructor() { super('GameScene'); }

  create(data) {
    const W = this.scale.width;
    const H = this.scale.height;

    // ── State ───────────────────────────────
    this.score    = data.score || 0;
    this.lives    = data.lives || 3;
    this.gameOver = false;
    this.lastShot = 0;
    this.shotDelay = 300;

    // Wave / level state
    this.currentLevel    = data.level || 0;
    this.currentWave     = 0;
    this.enemiesRemaining = 0;
    this.waveSpawned     = 0;
    this.waveActive      = false;
    this.waveTimer       = null;
    this.enemyFireTimer  = null;
    this.bossPhase       = false;
    this.boss            = null;
    this.bossGroup       = null;
    this.bossFireTimer   = null;
    this.bossHpBg        = null;
    this.bossHpBar       = null;
    this.bossDefeated    = false;

    // Player stats
    this.playerSpeed = 280;
    this.speedTimer  = null;
    this.powerTimer  = null;

    // ── Audio context ────────────────────────
    this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();

    // ── Background ──────────────────────────
    this.bg = this.add.tileSprite(0, 0, W, H, 'bg').setOrigin(0, 0);

    // ── Explosion animation ──────────────────
    if (!this.anims.exists('explode')) {
      this.anims.create({
        key: 'explode',
        frames: this.anims.generateFrameNumbers('explosion', { start: 0, end: 8 }),
        frameRate: 20,
        hideOnComplete: true
      });
    }

    // ── Physics groups ──────────────────────
    this.lasers      = this.physics.add.group();
    this.enemies     = this.physics.add.group();
    this.enemyLasers = this.physics.add.group();
    this.powerups    = this.physics.add.group();

    // ── Player ──────────────────────────────
    this.player = this.physics.add.sprite(W / 2, H - 80, 'player');
    this.player.setCollideWorldBounds(true);
    this.player.setDepth(1);

    // ── Input ───────────────────────────────
    this.cursors = this.input.keyboard.createCursorKeys();
    this.wasd = this.input.keyboard.addKeys({
      up:    Phaser.Input.Keyboard.KeyCodes.W,
      down:  Phaser.Input.Keyboard.KeyCodes.S,
      left:  Phaser.Input.Keyboard.KeyCodes.A,
      right: Phaser.Input.Keyboard.KeyCodes.D,
    });
    this.spaceKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);

    // ── Collisions ──────────────────────────
    this.physics.add.overlap(this.lasers, this.enemies, this.hitEnemy, null, this);
    this.physics.add.overlap(this.player, this.enemies, this.hitPlayer, null, this);
    this.physics.add.overlap(this.player, this.enemyLasers, this.hitPlayerByLaser, null, this);
    this.physics.add.overlap(this.player, this.powerups, this.collectPowerup, null, this);

    // ── HUD ─────────────────────────────────
    const sat = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--sat')) || 0;
    const hudTop = Math.max(sat + 10, 70); // at least 70px from top, +safe-area
    const style = { font: '24px monospace', fill: '#ffffff', stroke: '#000000', strokeThickness: 4 };
    this.scoreTxt  = this.add.text(10, hudTop,      'SCORE: ' + this.score, style).setDepth(10).setScrollFactor(0);
    this.livesTxt  = this.add.text(10, hudTop + 30, 'LIVES: ' + this.lives, style).setDepth(10).setScrollFactor(0);
    this.powerupTxt = this.add.text(10, hudTop + 60, '', { font: '18px monospace', fill: '#ffdd00', stroke: '#000000', strokeThickness: 3 }).setDepth(10).setScrollFactor(0);
    this.levelTxt = this.add.text(W - 10, hudTop,      'LEVEL ' + (this.currentLevel + 1), style).setOrigin(1, 0).setDepth(10).setScrollFactor(0);
    this.waveTxt  = this.add.text(W - 10, hudTop + 30, '', { font: '24px monospace', fill: '#aaaaff', stroke: '#000000', strokeThickness: 4 }).setOrigin(1, 0).setDepth(10).setScrollFactor(0);

    // expose scene reference for Playwright tests
    window.gameScene = this;

    // ── Start first wave ────────────────────
    this.time.delayedCall(500, () => this.startWave());
  }

  // ── Audio helpers ───────────────────────────
  playLaserSound() {
    const ctx = this.audioCtx;
    const osc  = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = 'square';
    osc.frequency.setValueAtTime(880, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(110, ctx.currentTime + 0.15);
    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.15);
  }

  playExplosionSound(large) {
    const ctx  = this.audioCtx;
    const osc  = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = 'sawtooth';
    const freq = large ? 120 : 220;
    const dur  = large ? 0.5  : 0.2;
    osc.frequency.setValueAtTime(freq, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(30, ctx.currentTime + dur);
    gain.gain.setValueAtTime(0.4, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + dur);
  }

  // ── Wave state machine ──────────────────────
  startWave() {
    const cfg = LEVELS[this.currentLevel];
    this.currentWave++;
    this.waveSpawned      = 0;
    this.enemiesRemaining = cfg.enemiesPerWave;
    this.waveActive       = true;

    // Update wave HUD
    this.waveTxt.setText(`WAVE ${this.currentWave}/${cfg.waves}`);

    // Spawn enemies one by one — save reference so we can cancel it early
    this.waveTimer = this.time.addEvent({
      delay: cfg.spawnDelay,
      callback: this.spawnWaveEnemy,
      callbackScope: this,
      repeat: cfg.enemiesPerWave - 1
    });

    // Enemy fire timer (rate increases each level)
    const enemyFireDelay = Math.max(2500 - this.currentLevel * 400, 800);
    this.enemyFireTimer = this.time.addEvent({
      delay: enemyFireDelay,
      callback: this.enemyFire,
      callbackScope: this,
      loop: true
    });
  }

  spawnWaveEnemy() {
    if (this.gameOver || !this.waveActive) return;
    const W   = this.scale.width;
    const cfg = LEVELS[this.currentLevel];
    const x   = Phaser.Math.Between(30, W - 30);
    const key = Phaser.Utils.Array.GetRandom(['enemy1', 'enemy2', 'enemy3']);
    const enemy = this.enemies.create(x, -30, key);
    enemy.setVelocityY(cfg.enemySpeed);
    enemy.setDepth(1);
    this.waveSpawned++;
  }

  onWaveCleared() {
    if (this.gameOver) return;
    // Stop spawn timer to prevent ghost enemies
    if (this.waveTimer) { this.waveTimer.remove(); this.waveTimer = null; }
    // Stop enemy fire timer
    if (this.enemyFireTimer) { this.enemyFireTimer.remove(); this.enemyFireTimer = null; }
    // Destroy any remaining ghost enemies on screen
    this.enemies.getChildren().forEach(e => { if (e.active) e.destroy(); });
    this.waveActive = false;
    const cfg = LEVELS[this.currentLevel];

    if (this.currentWave < cfg.waves) {
      // More waves — show overlay then start next wave
      this.showOverlayText(`WAVE ${this.currentWave + 1}`, 1500, () => this.startWave());
    } else {
      // All waves cleared — boss phase
      this.startBoss();
    }
  }

  // ── Enemy fire ──────────────────────────────
  enemyFire() {
    const alive = this.enemies.getChildren().filter(e => e.active);
    if (alive.length === 0) return;
    const shooter = Phaser.Utils.Array.GetRandom(alive);
    const laser = this.enemyLasers.create(shooter.x, shooter.y + 20, 'laserRed');
    laser.setVelocityY(280);
    laser.setDepth(1);
  }

  // ── Spawn enemy ─────────────────────────────
  spawnEnemy() {
    if (this.gameOver) return;
    const W = this.scale.width;
    const x = Phaser.Math.Between(30, W - 30);
    const key = Phaser.Utils.Array.GetRandom(['enemy1', 'enemy2', 'enemy3']);
    const enemy = this.enemies.create(x, -30, key);
    enemy.setVelocityY(120);
    enemy.setDepth(1);
  }

  // ── Fire laser ─────────────────────────────
  fireLaser() {
    const laser = this.lasers.create(this.player.x, this.player.y - 30, 'laserBlue');
    laser.setVelocityY(-600);
    laser.setDepth(1);
    this.lastShot = this.time.now;
    this.playLaserSound();
  }

  // ── Laser hits enemy ───────────────────────
  hitEnemy(laser, enemy) {
    // Guard: overlap fires every frame objects touch — only process once
    if (!laser.active || !enemy.active) return;
    const ex = enemy.x, ey = enemy.y;
    laser.destroy();
    enemy.destroy();
    this.spawnExplosion(ex, ey);
    this.playExplosionSound(false);
    this.score += 10;
    this.scoreTxt.setText('SCORE: ' + this.score);

    // 20% chance to drop a power-up
    if (Phaser.Math.Between(1, 5) === 1) {
      const type = Math.random() < 0.5 ? 'powerupSpeed' : 'powerupPower';
      const drop = this.powerups.create(ex, ey, type);
      drop.setVelocityY(110);
      drop.setDepth(1);
      drop.powerupType = type;
    }

    if (this.waveActive) {
      this.enemiesRemaining--;
      if (this.enemiesRemaining <= 0) this.onWaveCleared();
    }
  }

  // ── Enemy hits player ──────────────────────
  hitPlayer(player, enemy) {
    if (!enemy.active || !player.active) return;
    this.spawnExplosion(enemy.x, enemy.y);
    enemy.destroy();
    this.loseLife();
  }

  // ── Enemy laser hits player ─────────────────
  hitPlayerByLaser(player, laser) {
    if (!laser.active || !player.active) return;
    laser.destroy();
    this.loseLife();
  }

  loseLife() {
    this.lives--;
    this.livesTxt.setText('LIVES: ' + this.lives);
    if (this.lives <= 0) {
      this.endGame();
    } else {
      this.tweens.add({
        targets: this.player,
        alpha: 0,
        duration: 100,
        repeat: 5,
        yoyo: true,
        onComplete: () => { this.player.setAlpha(1); }
      });
    }
  }

  // ── Power-up collection ─────────────────────
  collectPowerup(player, drop) {
    if (!drop.active) return;
    const type = drop.powerupType;
    drop.destroy();
    if (type === 'powerupSpeed') {
      this.activateSpeedBoost();
    } else {
      this.activatePowerBoost();
    }
  }

  activateSpeedBoost() {
    if (this.speedTimer) this.speedTimer.remove();
    this.playerSpeed = 400;
    this.updatePowerupHUD();
    this.speedTimer = this.time.delayedCall(6000, () => {
      this.playerSpeed = 280;
      this.speedTimer = null;
      this.updatePowerupHUD();
    });
  }

  activatePowerBoost() {
    if (this.powerTimer) this.powerTimer.remove();
    this.shotDelay = 80;
    this.updatePowerupHUD();
    this.powerTimer = this.time.delayedCall(6000, () => {
      this.shotDelay = 300;
      this.powerTimer = null;
      this.updatePowerupHUD();
    });
  }

  updatePowerupHUD() {
    const parts = [];
    if (this.speedTimer) parts.push('⚡SPEED');
    if (this.powerTimer) parts.push('🔥POWER');
    this.powerupTxt.setText(parts.join('  '));
  }

  // ── Spawn explosion sprite ──────────────────
  spawnExplosion(x, y) {
    const exp = this.add.sprite(x, y, 'explosion').setDepth(2);
    exp.play('explode');
  }

  // ── Overlay text helper ─────────────────────
  showOverlayText(message, duration, onDone) {
    const W = this.scale.width;
    const H = this.scale.height;
    const txt = this.add.text(W / 2, H / 2, message, {
      font: '32px monospace', fill: '#ffff44'
    }).setOrigin(0.5).setDepth(20);

    this.time.delayedCall(duration, () => {
      txt.destroy();
      if (onDone) onDone();
    });
  }

  // ── Boss fight ──────────────────────────────
  startBoss() {
    // Stop wave-phase enemy fire before boss begins
    if (this.enemyFireTimer) { this.enemyFireTimer.remove(); this.enemyFireTimer = null; }
    this.bossPhase = true;
    const W = this.scale.width;
    const H = this.scale.height;
    const txt = this.add.text(W / 2, H / 2, '⚠ BOSS INCOMING ⚠', {
      font: '28px monospace', fill: '#ff4444'
    }).setOrigin(0.5).setDepth(10);

    this.tweens.add({
      targets: txt,
      alpha: 0,
      delay: 1500,
      duration: 500,
      onComplete: () => { txt.destroy(); this.spawnBoss(); }
    });
  }

  spawnBoss() {
    const W = this.scale.width;

    // Use a group so the overlap is group-vs-group (standard Phaser pattern)
    this.bossGroup = this.physics.add.group();
    this.boss = this.bossGroup.create(W / 2, -80, 'boss')
      .setDepth(1)
      .setScale(1.5);
    this.boss.body.setImmovable(true);
    this.boss.hp    = 10 + this.currentLevel * 15;
    this.boss.maxHp = this.boss.hp;

    // Fly in to y=120
    this.tweens.add({
      targets: this.boss,
      y: 120,
      duration: 1200,
      ease: 'Power2',
      onComplete: () => this.startBossMovement()
    });

    // HP bar
    this.bossHpBg  = this.add.rectangle(W / 2, 80, 200, 14, 0x550000).setDepth(10).setScrollFactor(0);
    this.bossHpBar = this.add.rectangle(W / 2 - 100, 80, 200, 14, 0xff2222)
      .setOrigin(0, 0.5).setDepth(10).setScrollFactor(0);

    // Collisions: player lasers hit boss
    this.physics.add.overlap(this.lasers, this.bossGroup, this.hitBoss, null, this);

    // Boss fires red lasers periodically
    const fireDelay = Math.max(1800 - this.currentLevel * 300, 800);
    this.bossFireTimer = this.time.addEvent({
      delay: fireDelay,
      callback: this.bossFire,
      callbackScope: this,
      loop: true
    });
  }

  startBossMovement() {
    const W = this.scale.width;
    this.tweens.add({
      targets: this.boss,
      x: { from: 80, to: W - 80 },
      duration: 2000,
      ease: 'Sine.InOut',
      yoyo: true,
      repeat: -1
    });
  }

  bossFire() {
    if (!this.boss || !this.boss.active) return;
    const offsets = [-30, 0, 30];
    offsets.forEach(offset => {
      const laser = this.enemyLasers.create(
        this.boss.x + offset,
        this.boss.y + 40,
        'laserRed'
      );
      laser.setVelocityY(350);
      laser.setDepth(1);
    });
  }

  hitBoss(laser, boss) {
    if (!laser.active || !boss.active) return;
    // Cache position BEFORE destroy — getters may be unreliable after
    const lx = laser.x;
    const ly = laser.y;
    laser.destroy();
    boss.hp--;

    const pct = boss.hp / boss.maxHp;
    this.bossHpBar.width = Math.max(0, 200 * pct);

    if (pct <= 0.5) boss.setTint(0xff6666);
    this.spawnExplosion(lx, ly);
    this.playExplosionSound(false);

    if (boss.hp <= 0) this.killBoss();
  }

  killBoss() {
    if (this.bossDefeated) return;
    this.bossDefeated = true;
    if (this.bossFireTimer) this.bossFireTimer.remove();
    if (this.bossHpBg)  this.bossHpBg.destroy();
    if (this.bossHpBar) this.bossHpBar.destroy();

    for (let i = 0; i < 5; i++) {
      this.time.delayedCall(i * 200, () => {
        if (!this.boss || !this.boss.active) return;
        const ox = Phaser.Math.Between(-40, 40);
        const oy = Phaser.Math.Between(-30, 30);
        this.spawnExplosion(this.boss.x + ox, this.boss.y + oy);
        this.playExplosionSound(i === 4); // large boom on last
      });
    }

    this.time.delayedCall(1200, () => {
      if (this.bossGroup) this.bossGroup.destroy(true);
      const bonus = 500;
      this.scene.start('LevelClearScene', {
        level:       this.currentLevel,
        score:       this.score + bonus,
        bonus,
        lives:       this.lives,
        totalLevels: LEVELS.length
      });
    });
  }

  // ── End game ───────────────────────────────
  endGame() {
    this.gameOver = true;
    if (this.waveTimer)      { this.waveTimer.remove();      this.waveTimer = null; }
    if (this.enemyFireTimer) { this.enemyFireTimer.remove(); this.enemyFireTimer = null; }
    if (this.bossFireTimer)  this.bossFireTimer.remove();
    this.physics.pause();
    this.player.setTint(0xff0000);
    this.time.delayedCall(800, () => {
      this.scene.start('GameOverScene', {
        score: this.score,
        level: this.currentLevel + 1
      });
    });
  }

  // ── Update loop ────────────────────────────
  update(time) {
    if (this.gameOver) return;

    // Scroll background
    this.bg.tilePositionY -= 2;

    // ── Player movement ──────────────────────
    const speed = this.playerSpeed;
    const pointer = this.input.activePointer;
    const isTouching = pointer.isDown;

    let vx = 0, vy = 0;
    if (isTouching) {
      const dx = pointer.x - this.player.x;
      const dy = pointer.y - this.player.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist > 8) { vx = (dx / dist) * speed; vy = (dy / dist) * speed; }
    } else {
      const left  = this.cursors.left.isDown  || this.wasd.left.isDown;
      const right = this.cursors.right.isDown || this.wasd.right.isDown;
      const up    = this.cursors.up.isDown    || this.wasd.up.isDown;
      const down  = this.cursors.down.isDown  || this.wasd.down.isDown;
      vx = right ? speed : left ? -speed : 0;
      vy = down  ? speed : up   ? -speed : 0;
    }
    this.player.setVelocityX(vx);
    this.player.setVelocityY(vy);

    // ── Shooting ─────────────────────────────
    const shouldFire = isTouching || this.cursors.space.isDown;
    if (shouldFire && time - this.lastShot > this.shotDelay) {
      // Resume AudioContext on first user gesture
      if (this.audioCtx.state === 'suspended') this.audioCtx.resume();
      this.fireLaser();
    }

    // ── Clean up off-screen objects ──────────
    const H = this.scale.height;

    this.lasers.getChildren().forEach(l => {
      if (l.active && l.y < -20) l.destroy();
    });

    this.enemyLasers.getChildren().forEach(l => {
      if (l.active && l.y > H + 20) l.destroy();
    });

    this.enemies.getChildren().forEach(e => {
      if (!e.active) return;
      if (e.y > H + 40) {
        e.destroy();
        if (this.waveActive) {
          this.enemiesRemaining--;
          if (this.enemiesRemaining <= 0) this.onWaveCleared();
        }
        this.lives--;
        this.livesTxt.setText('LIVES: ' + this.lives);
        if (this.lives <= 0) this.endGame();
      }
    });

    this.powerups.getChildren().forEach(p => {
      if (p.active && p.y > H + 20) p.destroy();
    });
  }
}

// ── LevelClearScene ────────────────────────────
class LevelClearScene extends Phaser.Scene {
  constructor() { super('LevelClearScene'); }

  create(data) {
    const { width: W, height: H } = this.scale;

    this.add.rectangle(W / 2, H / 2, W, H, 0x000000, 0.8);

    this.add.text(W / 2, H / 2 - 120, `★ LEVEL ${data.level + 1} CLEAR! ★`, {
      font: '36px monospace', fill: '#ffdd00'
    }).setOrigin(0.5);

    this.add.text(W / 2, H / 2 - 40, `SCORE: ${data.score}`, {
      font: '26px monospace', fill: '#ffffff'
    }).setOrigin(0.5);

    this.add.text(W / 2, H / 2 + 10, `BONUS: +${data.bonus}`, {
      font: '22px monospace', fill: '#44ff88'
    }).setOrigin(0.5);

    const nextLevel = data.level + 1;
    const hasNext   = nextLevel < data.totalLevels;
    const hintText  = hasNext
      ? `TAP OR PRESS SPACE FOR LEVEL ${nextLevel + 1}`
      : 'TAP OR PRESS SPACE TO WIN!';

    const hint = this.add.text(W / 2, H / 2 + 90, hintText, {
      font: '20px monospace', fill: '#aaaaaa'
    }).setOrigin(0.5);

    this.tweens.add({ targets: hint, alpha: 0, duration: 600, yoyo: true, repeat: -1 });

    const advance = () => {
      if (hasNext) {
        this.scene.start('GameScene', {
          level: nextLevel,
          score: data.score,
          lives: data.lives
        });
      } else {
        this.scene.start('VictoryScene', { score: data.score });
      }
    };
    this.input.keyboard.once('keydown-SPACE', advance);
    this.input.once('pointerdown', advance);
  }
}

// ── VictoryScene ───────────────────────────────
class VictoryScene extends Phaser.Scene {
  constructor() { super('VictoryScene'); }

  create(data) {
    const { width: W, height: H } = this.scale;

    this.add.rectangle(W / 2, H / 2, W, H, 0x000000, 0.8);

    this.add.text(W / 2, H / 2 - 100, '★ YOU WIN! ★', {
      font: '48px monospace', fill: '#ffdd00'
    }).setOrigin(0.5);

    this.add.text(W / 2, H / 2 - 20, 'FINAL SCORE: ' + (data.score || 0), {
      font: '28px monospace', fill: '#ffffff'
    }).setOrigin(0.5);

    const hint = this.add.text(W / 2, H / 2 + 70, 'TAP OR PRESS SPACE TO PLAY AGAIN', {
      font: '20px monospace', fill: '#aaaaaa'
    }).setOrigin(0.5);

    this.tweens.add({ targets: hint, alpha: 0, duration: 600, yoyo: true, repeat: -1 });

    const advance = () => { this.scene.start('GameScene'); };
    this.input.keyboard.once('keydown-SPACE', advance);
    this.input.once('pointerdown', advance);
  }
}

// ── GameOverScene ─────────────────────────────
class GameOverScene extends Phaser.Scene {
  constructor() { super('GameOverScene'); }

  create(data) {
    const { width: W, height: H } = this.scale;

    this.add.rectangle(W / 2, H / 2, W, H, 0x000000, 0.7);

    this.add.text(W / 2, H / 2 - 100, 'GAME OVER', {
      font: '48px monospace', fill: '#ff4444'
    }).setOrigin(0.5);

    this.add.text(W / 2, H / 2 - 30, 'SCORE: ' + (data.score || 0), {
      font: '28px monospace', fill: '#ffffff'
    }).setOrigin(0.5);

    if (data.level) {
      this.add.text(W / 2, H / 2 + 20, 'REACHED LEVEL ' + data.level, {
        font: '22px monospace', fill: '#ffaa44'
      }).setOrigin(0.5);
    }

    const hint = this.add.text(W / 2, H / 2 + 80, 'TAP OR PRESS SPACE TO PLAY AGAIN', {
      font: '20px monospace', fill: '#aaaaaa'
    }).setOrigin(0.5);

    this.tweens.add({ targets: hint, alpha: 0, duration: 600, yoyo: true, repeat: -1 });

    const advance = () => { this.scene.start('GameScene'); };
    this.input.keyboard.once('keydown-SPACE', advance);
    this.input.once('pointerdown', advance);
  }
}

// ── Phaser Game Config ────────────────────────
const config = {
  type: Phaser.AUTO,
  width: 390,
  height: 844,
  backgroundColor: '#000011',
  physics: {
    default: 'arcade',
    arcade: { gravity: { y: 0 }, debug: false }
  },
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  scene: [BootScene, GameScene, LevelClearScene, VictoryScene, GameOverScene]
};

const game = new Phaser.Game(config);
