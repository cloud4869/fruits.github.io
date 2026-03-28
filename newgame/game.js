// =============================================
// フルーツスラッシュ - メインゲームロジック
// =============================================

// === キャンバス設定 ===
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// ゲームの論理サイズ
const GAME_W = 480;
const GAME_H = 700;
canvas.width = GAME_W;
canvas.height = GAME_H;

// === フルーツの種類定義 ===
const FRUIT_TYPES = [
    { emoji: '🍉', color: '#ff4d4d', points: 3, radius: 32 },
    { emoji: '🍊', color: '#ff9933', points: 2, radius: 28 },
    { emoji: '🍎', color: '#cc2200', points: 2, radius: 27 },
    { emoji: '🍋', color: '#eeee00', points: 2, radius: 26 },
    { emoji: '🍇', color: '#9933ff', points: 3, radius: 28 },
    { emoji: '🍓', color: '#ff3366', points: 2, radius: 24 },
    { emoji: '🥝', color: '#66cc00', points: 3, radius: 26 },
    { emoji: '🍑', color: '#ffaa77', points: 2, radius: 27 },
    { emoji: '🍌', color: '#ffee55', points: 1, radius: 28 },
    { emoji: '🫐', color: '#4455cc', points: 2, radius: 25 },
];

// =============================================
// 難易度設定
// =============================================
const DIFFICULTIES = {
    easy: {
        label: 'やさしい',
        desc: 'ライフ5　爆弾なし　ゆっくり',
        maxLives: 5,
        baseSpawnInterval: 170,
        minSpawnInterval: 110,
        bombChance: 0,            // 爆弾なし
        gravity: 0.055,
        speedMult: 0.22,
        waveChance: 0.05,
    },
    normal: {
        label: 'ふつう',
        desc: 'ライフ5　爆弾あり　標準速度',
        maxLives: 5,
        baseSpawnInterval: 135,
        minSpawnInterval: 80,
        bombChance: 0.15,
        gravity: 0.07,
        speedMult: 0.28,
        waveChance: 0.12,
    },
    hard: {
        label: 'むずかしい',
        desc: 'ライフ5　爆弾多め　速め',
        maxLives: 5,
        baseSpawnInterval: 95,
        minSpawnInterval: 50,
        bombChance: 0.22,
        gravity: 0.045,           // 50%スロー
        speedMult: 0.18,          // 50%スロー
        waveChance: 0.20,
    },
};

// 選択中の難易度（デフォルト：ふつう）
let difficulty = DIFFICULTIES.normal;

// =============================================
// Web Audio API 音響システム
// =============================================
let audioCtx = null;

// AudioContextを初期化（最初のユーザー操作時に呼ぶ）
function initAudio() {
    if (audioCtx) return;
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
}

// スライス音（シュッという音）
function playSliceSound() {
    if (!audioCtx) return;
    const now = audioCtx.currentTime;

    // ノイズバッファを生成
    const bufLen = audioCtx.sampleRate * 0.08;
    const buf = audioCtx.createBuffer(1, bufLen, audioCtx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < bufLen; i++) data[i] = Math.random() * 2 - 1;

    const src = audioCtx.createBufferSource();
    src.buffer = buf;

    // 高周波フィルターで「シュッ」っぽい音に
    const filter = audioCtx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.value = 2000;

    const gain = audioCtx.createGain();
    gain.gain.setValueAtTime(0.4, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);

    src.connect(filter);
    filter.connect(gain);
    gain.connect(audioCtx.destination);
    src.start(now);
    src.stop(now + 0.08);
}

// コンボ音（コンボ数に応じて音程が上がる）
function playComboSound(comboCount) {
    if (!audioCtx) return;
    const now = audioCtx.currentTime;

    // コンボ数に応じた音程（C5〜C7）
    const baseFreqs = [523, 659, 784, 988, 1175, 1319, 1568];
    const freq = baseFreqs[Math.min(comboCount - 2, baseFreqs.length - 1)];

    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, now);
    osc.frequency.exponentialRampToValueAtTime(freq * 1.3, now + 0.15);

    gain.gain.setValueAtTime(0.45, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);

    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start(now);
    osc.stop(now + 0.25);
}

// 爆発音（ドカン）
function playExplosionSound() {
    if (!audioCtx) return;
    const now = audioCtx.currentTime;

    // 低周波ノイズで爆発音
    const bufLen = audioCtx.sampleRate * 0.6;
    const buf = audioCtx.createBuffer(1, bufLen, audioCtx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < bufLen; i++) data[i] = Math.random() * 2 - 1;

    const src = audioCtx.createBufferSource();
    src.buffer = buf;

    const filter = audioCtx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 250;

    const gain = audioCtx.createGain();
    gain.gain.setValueAtTime(1.2, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.6);

    src.connect(filter);
    filter.connect(gain);
    gain.connect(audioCtx.destination);
    src.start(now);
    src.stop(now + 0.6);
}

// ミス音（低いブザー音）
function playMissSound() {
    if (!audioCtx) return;
    const now = audioCtx.currentTime;

    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(150, now);
    osc.frequency.exponentialRampToValueAtTime(80, now + 0.3);

    gain.gain.setValueAtTime(0.3, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);

    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start(now);
    osc.stop(now + 0.3);
}

// =============================================
// ゲーム状態変数
// =============================================
let gameState = 'start'; // 'start' | 'playing' | 'gameover'
let score = 0;
let highScore = parseInt(localStorage.getItem('fruitSlashHighScore') || '0');
let lives = 3;
let frameCount = 0;
let spawnTimer = 0;

// コンボ関連
let comboCount = 0;       // 現在のコンボ数
let comboTimer = 0;       // コンボがリセットされるまでのタイマー
let maxCombo = 0;         // このゲームの最大コンボ数
const COMBO_TIMEOUT = 85; // 約1.4秒でコンボリセット

// ゲームオブジェクト配列
let fruits = [];
let particles = [];
let scoreTexts = [];
let bladePoints = [];

// 入力状態
let isSlicing = false;

// === 背景用の星（事前生成） ===
const stars = [];
for (let i = 0; i < 70; i++) {
    stars.push({
        x: Math.random() * GAME_W,
        y: Math.random() * GAME_H * 0.75,
        r: Math.random() * 1.5 + 0.3,
        alpha: Math.random() * 0.6 + 0.2,
    });
}

// =============================================
// フルーツクラス
// =============================================
class Fruit {
    constructor(overrideX = null, overrideVx = null, overrideVy = null) {
        const type = FRUIT_TYPES[Math.floor(Math.random() * FRUIT_TYPES.length)];
        this.emoji = type.emoji;
        this.color = type.color;
        this.points = type.points;
        this.radius = type.radius;

        // 初期位置（ウェーブ投擲時は外部から指定）
        this.x = overrideX !== null
            ? overrideX
            : this.radius + Math.random() * (GAME_W - this.radius * 2);
        this.y = GAME_H + this.radius;

        // 速度（ウェーブ投擲時は外部から指定、難易度倍率を適用）
        const s = difficulty.speedMult;
        this.vx = overrideVx !== null ? overrideVx : (Math.random() - 0.5) * 6 * s;
        this.vy = overrideVy !== null ? overrideVy : -(Math.random() * 8 + 30) * s; // 高く飛ぶよう初速を増加

        // 回転
        this.angle = Math.random() * Math.PI * 2;
        this.angularVelocity = (Math.random() - 0.5) * 0.12;

        this.alive = true;
        this.isBomb = false;
    }

    update() {
        this.vy += difficulty.gravity;
        this.x += this.vx;
        this.y += this.vy;
        this.angle += this.angularVelocity;
    }

    draw() {
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.angle);
        ctx.font = `${this.radius * 1.9}px serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(this.emoji, 0, 0);
        ctx.restore();
    }

    isOutOfBounds() {
        return this.y > GAME_H + this.radius * 2;
    }
}

// =============================================
// 爆弾クラス
// =============================================
class Bomb extends Fruit {
    constructor() {
        super();
        this.emoji = '💣';
        this.color = '#555555';
        this.radius = 28;
        this.isBomb = true;

        // 爆弾はやや遅め
        const s = difficulty.speedMult;
        this.vx = (Math.random() - 0.5) * 4 * s;
        this.vy = -(Math.random() * 6 + 10) * s;
    }
}

// =============================================
// パーティクルクラス
// =============================================
class Particle {
    constructor(x, y, color) {
        this.x = x;
        this.y = y;
        this.color = color;

        const angle = Math.random() * Math.PI * 2;
        const speed = Math.random() * 8 + 2;
        this.vx = Math.cos(angle) * speed;
        this.vy = Math.sin(angle) * speed - 3;

        this.radius = Math.random() * 6 + 3;
        this.life = 1.0;
        this.decay = Math.random() * 0.03 + 0.02;
    }

    update() {
        this.x += this.vx;
        this.y += this.vy;
        this.vy += 0.35;
        this.life -= this.decay;
        this.radius *= 0.96;
    }

    draw() {
        ctx.save();
        ctx.globalAlpha = Math.max(0, this.life);
        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }
}

// =============================================
// スコアテキストクラス（+N が浮き上がるエフェクト）
// =============================================
class ScoreText {
    constructor(x, y, text, color = '#ffff00', fontSize = 30) {
        this.x = x;
        this.y = y;
        this.text = text;
        this.color = color;
        this.fontSize = fontSize;
        this.life = 1.0;
        this.vy = -2.5;
    }

    update() {
        this.y += this.vy;
        this.vy *= 0.96;
        this.life -= 0.022;
    }

    draw() {
        ctx.save();
        ctx.globalAlpha = Math.max(0, this.life);
        ctx.font = `bold ${this.fontSize}px Arial`;
        ctx.textAlign = 'center';
        ctx.strokeStyle = 'rgba(0,0,0,0.85)';
        ctx.lineWidth = 4;
        ctx.strokeText(this.text, this.x, this.y);
        ctx.fillStyle = this.color;
        ctx.fillText(this.text, this.x, this.y);
        ctx.restore();
    }
}

// =============================================
// スポーン処理（通常・ウェーブ）
// =============================================
function spawnObjects() {
    // 同時出現3個まで制限
    if (fruits.length >= 3) return;

    // スコアに応じてスポーン間隔を短縮（難易度上昇）
    const interval = Math.max(
        difficulty.minSpawnInterval,
        difficulty.baseSpawnInterval - Math.floor(score / 8) * 4
    );
    if (spawnTimer < interval) return;
    spawnTimer = 0;

    // 爆弾スポーン判定（スコア5以上から出現）
    if (score >= 5 && Math.random() < difficulty.bombChance) {
        fruits.push(new Bomb());
        return;
    }

    // ウェーブ投擲（複数フルーツを扇状に同時発射）
    if (Math.random() < difficulty.waveChance) {
        spawnWave();
        return;
    }

    // 通常スポーン（基本1個、空っぽ時のみまれに2個）
    const count = (Math.random() < 0.15 && fruits.length === 0) ? 2 : 1;
    for (let i = 0; i < count; i++) {
        fruits.push(new Fruit());
    }
}

// ウェーブ投擲：3〜5個のフルーツを扇形に発射
function spawnWave() {
    const count = 3 + Math.floor(Math.random() * 3); // 3〜5個
    const centerX = 80 + Math.random() * (GAME_W - 160);
    const s = difficulty.speedMult;
    const baseSpeed = (20 + Math.random() * 6) * s; // フルーツの初速に合わせて調整

    for (let i = 0; i < count; i++) {
        // -40°〜+40° の扇形に角速度を分散
        const spreadRatio = count > 1 ? (i / (count - 1) - 0.5) : 0;
        const angle = spreadRatio * (Math.PI * 0.7);

        const vx = Math.sin(angle) * baseSpeed;
        const vy = -Math.cos(angle) * baseSpeed;

        // 少し時間差をつけて発射（連続感を演出）
        setTimeout(() => {
            // 同時出現3個まで制限
            if (gameState === 'playing' && fruits.length < 3) {
                fruits.push(new Fruit(centerX, vx, vy));
            }
        }, i * 60);
    }
}

// =============================================
// 衝突判定（ブレード vs フルーツ）
// =============================================

// 点(px,py)と線分(ax,ay)-(bx,by)の距離
function pointToSegmentDist(px, py, ax, ay, bx, by) {
    const dx = bx - ax;
    const dy = by - ay;
    const lenSq = dx * dx + dy * dy;
    if (lenSq === 0) return Math.hypot(px - ax, py - ay);

    let t = ((px - ax) * dx + (py - ay) * dy) / lenSq;
    t = Math.max(0, Math.min(1, t));
    return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

function checkBladeCollision() {
    if (bladePoints.length < 2) return;

    const p1 = bladePoints[bladePoints.length - 2];
    const p2 = bladePoints[bladePoints.length - 1];

    // ブレードが十分速く動いている時のみ判定
    const speed = Math.hypot(p2.x - p1.x, p2.y - p1.y);
    if (speed < 3) return;

    for (const obj of fruits) {
        if (!obj.alive) continue;

        const dist = pointToSegmentDist(obj.x, obj.y, p1.x, p1.y, p2.x, p2.y);
        if (dist < obj.radius * 1.1) {
            obj.alive = false;

            if (obj.isBomb) {
                // 爆弾ヒット → 爆発 → ゲームオーバー
                spawnExplosionEffect(obj.x, obj.y);
                scoreTexts.push(new ScoreText(obj.x, obj.y - 30, '💥 BOOM!', '#ff4400', 34));
                playExplosionSound();
                resetCombo();
                endGame();
            } else {
                cutFruit(obj);
            }
        }
    }
}

// =============================================
// フルーツカット処理（コンボシステム含む）
// =============================================
function cutFruit(fruit) {
    // コンボカウントを増やす
    comboCount++;
    comboTimer = 0;
    if (comboCount > maxCombo) maxCombo = comboCount;

    // コンボ倍率でポイント計算
    const multiplier = comboCount;
    const earned = fruit.points * multiplier;
    score += earned;
    updateScoreDisplay();
    updateComboDisplay();

    // スライス音
    playSliceSound();

    // コンボ2以上でコンボ音とコンボテキスト
    if (comboCount >= 2) {
        playComboSound(comboCount);
        scoreTexts.push(new ScoreText(
            fruit.x,
            fruit.y - 55,
            `COMBO x${comboCount}!`,
            '#ff9900',
            28
        ));
    }

    // スコアテキスト（コンボ時は倍率を表示）
    const scoreLabel = multiplier > 1 ? `+${earned} (x${multiplier})` : `+${earned}`;
    scoreTexts.push(new ScoreText(fruit.x, fruit.y - 20, scoreLabel));

    // パーティクルエフェクト
    for (let i = 0; i < 14; i++) {
        particles.push(new Particle(fruit.x, fruit.y, fruit.color));
    }
    for (let i = 0; i < 5; i++) {
        particles.push(new Particle(fruit.x, fruit.y, '#ffffff'));
    }
}

// 爆弾爆発エフェクト
function spawnExplosionEffect(x, y) {
    for (let i = 0; i < 35; i++) {
        const p = new Particle(x, y, i % 2 === 0 ? '#ff5500' : '#ffaa00');
        p.vx = (Math.random() - 0.5) * 20;
        p.vy = (Math.random() - 0.5) * 20;
        p.radius = Math.random() * 9 + 4;
        particles.push(p);
    }
}

// =============================================
// コンボ管理
// =============================================
function updateComboTimer() {
    if (comboCount < 1) return;

    comboTimer++;
    if (comboTimer >= COMBO_TIMEOUT) {
        resetCombo();
    }
}

function resetCombo() {
    comboCount = 0;
    comboTimer = 0;
    updateComboDisplay();
}

function updateComboDisplay() {
    const el = document.getElementById('combo-display');
    const countEl = document.getElementById('combo-count');
    if (!el || !countEl) return;

    if (comboCount >= 2) {
        el.classList.remove('hidden');
        countEl.textContent = `x${comboCount}`;
        // アニメーションを再トリガー
        el.style.animation = 'none';
        el.offsetWidth; // リフロー
        el.style.animation = 'comboPulse 0.3s ease-out';
    } else {
        el.classList.add('hidden');
    }
}

// =============================================
// 画面描画
// =============================================
function drawBackground() {
    const gradient = ctx.createLinearGradient(0, 0, 0, GAME_H);
    gradient.addColorStop(0, '#050515');
    gradient.addColorStop(0.6, '#0d0830');
    gradient.addColorStop(1, '#1a0a40');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, GAME_W, GAME_H);

    // 星
    stars.forEach(s => {
        ctx.fillStyle = `rgba(255, 255, 255, ${s.alpha})`;
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
        ctx.fill();
    });
}

// ブレード軌跡描画
function drawBlade() {
    if (bladePoints.length < 2) return;

    for (let i = 1; i < bladePoints.length; i++) {
        const ratio = i / bladePoints.length;

        ctx.save();
        ctx.globalAlpha = ratio * 0.85;
        ctx.strokeStyle = 'rgba(180, 230, 255, 1)';
        ctx.lineWidth = ratio * 6;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.shadowBlur = 12;
        ctx.shadowColor = 'rgba(100, 180, 255, 0.9)';
        ctx.beginPath();
        ctx.moveTo(bladePoints[i - 1].x, bladePoints[i - 1].y);
        ctx.lineTo(bladePoints[i].x, bladePoints[i].y);
        ctx.stroke();
        ctx.restore();
    }
}

// =============================================
// UI更新
// =============================================
function updateScoreDisplay() {
    document.getElementById('score').textContent = score;
}

function updateLivesDisplay() {
    const maxLives = difficulty.maxLives;
    for (let i = 1; i <= 5; i++) {
        const el = document.getElementById(`life${i}`);
        if (!el) continue;
        if (i > maxLives) {
            // この難易度では使わないライフは非表示
            el.classList.add('hidden');
        } else {
            el.classList.remove('hidden');
            el.style.opacity = i <= lives ? '1' : '0.15';
            el.style.filter  = i <= lives ? 'none' : 'grayscale(100%)';
        }
    }
}

// フルーツを逃したとき
function onFruitMissed() {
    lives--;
    updateLivesDisplay();
    playMissSound();

    if (lives <= 0) {
        endGame();
    }
}

// =============================================
// ゲーム状態管理
// =============================================
function startGame() {
    initAudio(); // 初回操作時にAudioContextを起動

    gameState = 'playing';
    score = 0;
    lives = difficulty.maxLives;
    frameCount = 0;
    spawnTimer = 0;
    comboCount = 0;
    comboTimer = 0;
    maxCombo = 0;
    fruits = [];
    particles = [];
    scoreTexts = [];
    bladePoints = [];
    isSlicing = false;

    updateScoreDisplay();
    updateLivesDisplay();
    updateComboDisplay();

    document.getElementById('start-screen').classList.add('hidden');
    document.getElementById('gameover-screen').classList.add('hidden');
}

function endGame() {
    gameState = 'gameover';

    // ハイスコア更新
    if (score > highScore) {
        highScore = score;
        localStorage.setItem('fruitSlashHighScore', String(highScore));
    }

    document.getElementById('final-score').textContent = `スコア: ${score}`;
    document.getElementById('final-combo').textContent = `最大コンボ: ${maxCombo}`;
    document.getElementById('high-score-display').textContent = `ハイスコア: ${highScore}`;

    setTimeout(() => {
        document.getElementById('gameover-screen').classList.remove('hidden');
    }, 600);
}

// =============================================
// メインゲームループ
// =============================================
function gameLoop() {
    drawBackground();

    if (gameState === 'playing') {
        frameCount++;
        spawnTimer++;

        // コンボタイマー更新
        updateComboTimer();

        // スポーン処理
        spawnObjects();

        // フルーツ・爆弾の更新と描画
        for (let i = fruits.length - 1; i >= 0; i--) {
            const obj = fruits[i];

            if (!obj.alive) {
                fruits.splice(i, 1);
                continue;
            }

            obj.update();

            // 画面下への落下：アウト（ミスあり）
            if (obj.y > GAME_H + obj.radius * 2) {
                fruits.splice(i, 1);
                if (!obj.isBomb) {
                    resetCombo(); // フルーツを逃すとコンボリセット
                    onFruitMissed();
                }
                continue;
            }

            // 画面横にはみ出た場合：ミスなしで削除
            if (obj.x < -obj.radius * 2 || obj.x > GAME_W + obj.radius * 2) {
                fruits.splice(i, 1);
                continue;
            }

            obj.draw();
        }

        // パーティクル更新・描画
        for (let i = particles.length - 1; i >= 0; i--) {
            const p = particles[i];
            p.update();
            if (p.life <= 0) { particles.splice(i, 1); continue; }
            p.draw();
        }

        // スコアテキスト更新・描画
        for (let i = scoreTexts.length - 1; i >= 0; i--) {
            const st = scoreTexts[i];
            st.update();
            if (st.life <= 0) { scoreTexts.splice(i, 1); continue; }
            st.draw();
        }

        // ブレード描画
        drawBlade();

        // 衝突判定
        if (isSlicing) checkBladeCollision();
    }

    requestAnimationFrame(gameLoop);
}

// =============================================
// 入力処理（マウス）
// =============================================
canvas.addEventListener('mousedown', (e) => {
    if (gameState !== 'playing') return;
    isSlicing = true;
    bladePoints = [getCanvasPos(e)];
});

canvas.addEventListener('mousemove', (e) => {
    if (!isSlicing || gameState !== 'playing') return;
    bladePoints.push(getCanvasPos(e));
    if (bladePoints.length > 30) bladePoints.shift();
});

canvas.addEventListener('mouseup',    () => { isSlicing = false; bladePoints = []; });
canvas.addEventListener('mouseleave', () => { isSlicing = false; bladePoints = []; });

// =============================================
// 入力処理（タッチ）
// =============================================
canvas.addEventListener('touchstart', (e) => {
    e.preventDefault();
    if (gameState !== 'playing') return;
    isSlicing = true;
    bladePoints = [getCanvasTouchPos(e.touches[0])];
}, { passive: false });

canvas.addEventListener('touchmove', (e) => {
    e.preventDefault();
    if (!isSlicing || gameState !== 'playing') return;
    bladePoints.push(getCanvasTouchPos(e.touches[0]));
    if (bladePoints.length > 30) bladePoints.shift();
}, { passive: false });

canvas.addEventListener('touchend', () => { isSlicing = false; bladePoints = []; });

// =============================================
// 座標変換ヘルパー
// =============================================
function getCanvasPos(e) {
    const rect = canvas.getBoundingClientRect();
    return {
        x: (e.clientX - rect.left) * (GAME_W / rect.width),
        y: (e.clientY - rect.top)  * (GAME_H / rect.height),
    };
}

function getCanvasTouchPos(touch) {
    const rect = canvas.getBoundingClientRect();
    return {
        x: (touch.clientX - rect.left) * (GAME_W / rect.width),
        y: (touch.clientY - rect.top)  * (GAME_H / rect.height),
    };
}

// =============================================
// 難易度選択UI
// =============================================
const diffDescriptions = {
    easy:   'ライフ5　爆弾なし　ゆっくり',
    normal: 'ライフ5　爆弾あり　標準速度',
    hard:   'ライフ5　爆弾多め　速め',
};

document.querySelectorAll('.diff-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        // 選択ボタンを更新
        document.querySelectorAll('.diff-btn').forEach(b => b.classList.remove('selected'));
        btn.classList.add('selected');

        // 難易度を切り替え
        const key = btn.dataset.diff;
        difficulty = DIFFICULTIES[key];

        // 説明テキストを更新
        document.getElementById('diff-desc').textContent = diffDescriptions[key];
    });
});

// =============================================
// ボタンイベント
// =============================================
document.getElementById('start-btn').addEventListener('click', startGame);
document.getElementById('restart-btn').addEventListener('click', () => {
    // ゲームオーバー後は難易度選択画面に戻す
    document.getElementById('gameover-screen').classList.add('hidden');
    document.getElementById('start-screen').classList.remove('hidden');
});

// =============================================
// ゲームループ開始
// =============================================
gameLoop();
