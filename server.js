/**
 * CS:GO ONLINE - CHEAT
 * Server v6.0 — production-ready for hosting
 * Fixes: proper CORS, transports, proxy trust, 0.0.0.0 bind
 */

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const fs = require('fs');
const path = require('path');

const app = express();
const server = http.createServer(app);

// ===== SOCKET.IO — hosting-compatible config =====
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  },
  // Allow both polling and websocket — critical for hosting behind proxies
  transports: ['polling', 'websocket'],
  // Increase timeouts for slow connections
  pingTimeout: 60000,
  pingInterval: 25000,
  upgradeTimeout: 30000,
  // Allow upgrades from polling to websocket
  allowUpgrades: true,
  // For proxies like Railway/Render that terminate SSL
  allowEIO3: true
});

// Trust proxy (Railway, Render, Heroku all use reverse proxies)
app.set('trust proxy', 1);

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));

// Health check endpoint — keeps the server alive on free tiers
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    rooms: rooms.size,
    uptime: Math.floor(process.uptime()),
    timestamp: Date.now()
  });
});

// Root redirect just in case
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ===== CONSTANTS =====
const TICK_RATE     = 20;
const TICK_MS       = 1000 / TICK_RATE;
const TILE_SIZE     = 32;
const MAP_W         = 40;
const MAP_H         = 30;
const MAX_PLAYERS   = 10;
const MAX_PER_TEAM  = 5;
const ROUND_TIME    = 120;
const BETWEEN_ROUND = 10;
const PLAYER_SPEED  = 3.5;
const PLAYER_RADIUS = 12;
const BULLET_SPEED  = 14;
const RESPAWN_TIME  = 3000;
const SHIELD_TIME   = 5000;

const WEAPONS = {
  pistol: { damage:15, fireRate:400,  magSize:12, reloadTime:1200, spread:0.08, name:'Pistol' },
  ak:     { damage:22, fireRate:100,  magSize:30, reloadTime:2200, spread:0.06, name:'AK'     },
  awp:    { damage:90, fireRate:1500, magSize:5,  reloadTime:3000, spread:0.01, name:'AWP'    }
};

// ===== MAP: LEGO ARENA (40x30) =====
const MAP_DATA = [
  [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
  [1,2,2,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,0,0,0,0,0,0,3,3,3,1],
  [1,2,0,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,3,3,1],
  [1,0,0,4,4,0,0,0,0,0,0,0,0,0,4,0,0,0,0,0,0,0,0,0,0,4,0,0,0,0,0,0,0,0,0,4,4,0,0,1],
  [1,0,0,4,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,4,0,0,1],
  [1,0,0,0,0,0,0,1,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,1,0,0,0,0,0,0,0,0,0,1],
  [1,0,0,0,0,0,0,1,0,0,0,0,0,4,4,4,0,0,0,0,0,4,4,4,0,0,0,0,0,1,0,0,0,0,0,0,0,0,0,1],
  [1,0,0,0,0,0,0,0,0,0,0,0,0,4,0,4,0,0,0,0,0,4,0,4,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
  [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
  [1,1,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,4,4,0,0,4,4,0,0,0,0,0,0,0,0,0,0,0,0,0,1,1,1,1],
  [1,0,0,0,0,0,0,0,0,0,4,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,4,0,0,0,0,0,0,0,0,0,0,0,0,1],
  [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
  [1,0,0,0,0,0,1,1,0,0,0,0,0,0,0,4,4,0,0,4,4,0,0,0,0,0,0,0,1,1,0,0,0,0,0,0,0,0,0,1],
  [1,0,0,4,0,0,0,0,0,0,0,0,0,0,0,4,0,0,0,0,4,0,0,0,0,0,0,0,0,0,0,0,0,0,4,0,0,0,0,1],
  [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
  [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,4,0,0,0,4,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
  [1,0,0,4,0,0,0,0,0,0,0,0,0,0,0,4,0,0,0,0,0,0,4,0,0,0,0,0,0,0,0,0,0,0,4,0,0,0,0,1],
  [1,0,0,0,0,0,1,1,0,0,0,0,0,0,0,4,4,0,0,4,4,0,0,0,0,0,0,0,1,1,0,0,0,0,0,0,0,0,0,1],
  [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
  [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
  [1,1,1,0,0,0,0,0,0,0,4,0,0,0,0,0,0,0,0,0,0,0,0,0,0,4,0,0,0,0,0,0,0,0,0,0,1,1,1,1],
  [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,4,4,0,0,4,4,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
  [1,0,0,0,0,0,0,0,0,0,0,0,0,4,0,4,0,0,0,0,0,0,0,4,0,4,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
  [1,0,0,0,0,0,0,1,0,0,0,0,0,4,4,4,0,0,0,0,0,4,4,4,0,0,0,0,1,0,0,0,0,0,0,0,0,0,0,1],
  [1,0,0,4,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,4,0,0,0,0,1],
  [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
  [1,2,2,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,0,0,0,0,0,0,3,3,3,1],
  [1,2,0,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,3,3,1],
  [1,0,0,4,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,4,0,0,1],
  [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1]
];

function getSpawnPoints(team) {
  const points = [];
  for (let y = 0; y < MAP_H; y++)
    for (let x = 0; x < MAP_W; x++) {
      if (team === 'T'  && MAP_DATA[y][x] === 2) points.push({ x: x*TILE_SIZE+16, y: y*TILE_SIZE+16 });
      if (team === 'CT' && MAP_DATA[y][x] === 3) points.push({ x: x*TILE_SIZE+16, y: y*TILE_SIZE+16 });
    }
  return points;
}

function randomSpawn(team) {
  const pts = getSpawnPoints(team);
  if (!pts.length) return { x: 64, y: 64 };
  return pts[Math.floor(Math.random() * pts.length)];
}

// ===== COLLISION =====
function isSolid(t) { return t === 1 || t === 4; }

function getTile(x, y) {
  const tx = Math.floor(x / TILE_SIZE), ty = Math.floor(y / TILE_SIZE);
  if (tx < 0 || tx >= MAP_W || ty < 0 || ty >= MAP_H) return 1;
  return MAP_DATA[ty][tx];
}

function canMove(x, y, r) {
  const pts = [
    {x:x-r,y:y-r},{x:x+r,y:y-r},{x:x-r,y:y+r},{x:x+r,y:y+r},
    {x:x,y:y-r},{x:x,y:y+r},{x:x-r,y:y},{x:x+r,y:y}
  ];
  for (const p of pts) if (isSolid(getTile(p.x, p.y))) return false;
  return true;
}

function raycast(x0, y0, x1, y1) {
  let dx = x1-x0, dy = y1-y0;
  const dist = Math.sqrt(dx*dx + dy*dy);
  if (!dist) return { hit:false, x:x1, y:y1 };
  dx /= dist; dy /= dist;
  let cx = x0, cy = y0;
  for (let i = 0; i < Math.ceil(dist); i++) {
    cx += dx; cy += dy;
    if (isSolid(getTile(cx, cy))) return { hit:true, x:cx, y:cy };
  }
  return { hit:false, x:x1, y:y1 };
}

function hasLOS(ax, ay, bx, by) {
  const res = raycast(ax, ay, bx, by);
  if (!res.hit) return true;
  const hd = Math.hypot(res.x-ax, res.y-ay);
  const td = Math.hypot(bx-ax, by-ay);
  return hd >= td;
}

// ===== CHAT FILTER =====
const BAD_WORDS = [
  'fuck','shit','ass','bitch','cunt','dick','pussy','nigger','faggot','retard',
  'whore','slut','bastard','damn','hell','cock','prick','twat','wank','bollocks',
  'хуй','пизда','блядь','ёбаный','ёб','еб','сука','мудак','пиздец','ублюдок',
  'залупа','хуйня','пиздун','шлюха','манда','ёбля','уёбок','пиздатый','хуёво','курва'
];
const URL_PATTERN = /https?:\/\/|www\.|\.(com|ru|net|org|io|gg)/gi;

function filterMessage(text) {
  let f = text;
  for (const w of BAD_WORDS) f = f.replace(new RegExp(w, 'gi'), '***');
  return f.replace(URL_PATTERN, '***');
}

// ===== LEADERBOARD =====
const LB_PATH = path.join(__dirname, 'data', 'leaderboard.json');
const LB_TMP  = LB_PATH + '.tmp';

function ensureDataDir() {
  const dir = path.join(__dirname, 'data');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  if (!fs.existsSync(LB_PATH)) fs.writeFileSync(LB_PATH, '[]', 'utf8');
}

function loadLeaderboard() {
  try {
    const raw = fs.readFileSync(LB_PATH, 'utf8');
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch(e) {
    console.warn('[LB] Load error:', e.message);
    return [];
  }
}

function saveLeaderboard(lb) {
  try {
    const data = JSON.stringify(lb, null, 2);
    fs.writeFileSync(LB_TMP, data, 'utf8');
    fs.renameSync(LB_TMP, LB_PATH);
  } catch(e) {
    console.error('[LB] Save error:', e.message);
    try { fs.writeFileSync(LB_PATH, JSON.stringify(lb, null, 2), 'utf8'); } catch(_){}
  }
}

function updateLeaderboard(nick, kills, deaths) {
  const lb = loadLeaderboard();
  let e = lb.find(x => x.nickname === nick);
  if (!e) { e = { nickname: nick, kills: 0, deaths: 0 }; lb.push(e); }
  e.kills  += kills;
  e.deaths += deaths;
  lb.sort((a, b) => b.kills - a.kills);
  saveLeaderboard(lb.slice(0, 50));
}

// ===== ROOMS =====
const rooms = new Map();
let roomIdCounter = 1;

function createRoom(name) {
  const id = 'room_' + (roomIdCounter++);
  const state = {
    id, name,
    players: new Map(),
    bullets: [],
    roundTime: ROUND_TIME,
    roundPhase: 'play',
    roundNum: 1,
    tScore: 0, ctScore: 0,
    lastTickTime: Date.now(),
    tickInterval: null,
    emptyTimer: null,
    killFeed: []
  };
  state.tickInterval = setInterval(() => {
    const now = Date.now();
    const dt = (now - state.lastTickTime) / 1000;
    state.lastTickTime = now;
    gameTick(state, dt, now);
  }, TICK_MS);
  rooms.set(id, state);
  console.log(`[Room] Created: "${name}" (${id})`);
  return state;
}

function deleteRoom(id) {
  const s = rooms.get(id);
  if (!s) return;
  clearInterval(s.tickInterval);
  clearTimeout(s.emptyTimer);
  rooms.delete(id);
  console.log(`[Room] Deleted: ${id}`);
}

function getRoomList() {
  return [...rooms.values()].map(r => {
    let tC=0, ctC=0;
    r.players.forEach(p => p.team==='T' ? tC++ : ctC++);
    return {
      id: r.id, name: r.name,
      playerCount: r.players.size,
      maxPlayers: MAX_PLAYERS,
      tCount: tC, ctCount: ctC,
      roundNum: r.roundNum,
      phase: r.roundPhase
    };
  });
}

function countTeam(state, team) {
  let c = 0;
  state.players.forEach(p => { if (p.team === team) c++; });
  return c;
}

function createPlayer(socketId, nickname, team) {
  const spawn = randomSpawn(team);
  return {
    id: socketId, nickname, team,
    x: spawn.x, y: spawn.y,
    angle: 0, hp: 100, alive: true,
    shieldUntil: Date.now() + SHIELD_TIME,
    weapon: 'pistol', ammo: WEAPONS.pistol.magSize,
    reloading: false, reloadEnd: 0, lastShot: 0,
    kills: 0, deaths: 0, respawnAt: 0, ping: 0,
    cheats: {
      aimbot:false, aimbotSmooth:5, aimbotFOV:60,
      antiAim:false, fakeLag:false,
      spinbot:false, spinSpeed:10,
      bhop:false, noRecoil:false, radarHack:false,
      skin:0, trail:0
    },
    spinAngle: 0,
    chatLog: [], chatMutedUntil: 0, lastChatMsg: ''
  };
}

// ===== GAME TICK =====
function gameTick(state, dt, now) {
  if (state.roundPhase === 'between') {
    state.roundTime -= dt;
    if (state.roundTime <= 0) startNewRound(state, now);
    broadcastState(state, now);
    return;
  }

  state.roundTime -= dt;
  if (state.roundTime <= 0) { endRound(state, now); return; }

  state.players.forEach(p => {
    if (!p.alive) {
      if (now >= p.respawnAt && p.respawnAt > 0) respawnPlayer(p, now);
      return;
    }
    if (p.cheats.spinbot) p.spinAngle += p.cheats.spinSpeed * 5 * Math.PI / 180;
    if (p.reloading && now >= p.reloadEnd) {
      p.reloading = false;
      p.ammo = WEAPONS[p.weapon].magSize;
    }
  });

  const kept = [];
  for (const b of state.bullets) {
    b.x += Math.cos(b.angle) * BULLET_SPEED;
    b.y += Math.sin(b.angle) * BULLET_SPEED;
    b.dist += BULLET_SPEED;
    if (b.dist > 900) continue;
    if (isSolid(getTile(b.x, b.y))) continue;
    let hit = false;
    state.players.forEach(t => {
      if (hit || t.id === b.ownerId || !t.alive || t.team === b.ownerTeam) return;
      if (now < t.shieldUntil) return;
      if (Math.hypot(t.x - b.x, t.y - b.y) < PLAYER_RADIUS + 4) {
        hit = true;
        applyDamage(state, b.ownerId, t, b.damage, b.weaponName, now);
      }
    });
    if (!hit) kept.push(b);
  }
  state.bullets = kept;
  broadcastState(state, now);
}

function applyDamage(state, attackerId, target, damage, weaponName, now) {
  target.hp -= damage;
  if (target.hp > 0) return;
  target.hp = 0; target.alive = false; target.deaths++;
  target.respawnAt = now + RESPAWN_TIME;
  const att = state.players.get(attackerId);
  if (!att) return;
  att.kills++;
  if (att.team === 'T') state.tScore++; else state.ctScore++;
  const kill = { killer: att.nickname, victim: target.nickname, weapon: weaponName, t: now };
  state.killFeed.push(kill);
  if (state.killFeed.length > 5) state.killFeed.shift();
  updateLeaderboard(att.nickname, 1, 0);
  updateLeaderboard(target.nickname, 0, 1);
  io.to(state.id).emit('kill_event', kill);
}

function respawnPlayer(p, now) {
  const sp = randomSpawn(p.team);
  p.x = sp.x; p.y = sp.y; p.hp = 100; p.alive = true;
  p.shieldUntil = now + SHIELD_TIME;
  p.ammo = WEAPONS[p.weapon].magSize; p.reloading = false; p.respawnAt = 0;
}

function endRound(state, now) {
  let winner = 'Draw';
  if (state.tScore > state.ctScore) winner = 'Terrorists';
  else if (state.ctScore > state.tScore) winner = 'Counter-Terrorists';
  state.roundPhase = 'between'; state.roundTime = BETWEEN_ROUND;
  io.to(state.id).emit('round_end', { winner, tScore: state.tScore, ctScore: state.ctScore, roundNum: state.roundNum });
}

function startNewRound(state, now) {
  state.roundNum++; state.roundPhase = 'play'; state.roundTime = ROUND_TIME;
  state.bullets = []; state.killFeed = [];
  state.players.forEach(p => respawnPlayer(p, now));
  io.to(state.id).emit('round_start', { roundNum: state.roundNum, tScore: state.tScore, ctScore: state.ctScore });
}

function broadcastState(state, now) {
  const players = [];
  state.players.forEach(p => players.push({
    id: p.id, nickname: p.nickname, team: p.team,
    x: p.x, y: p.y, angle: p.angle,
    hp: p.hp, alive: p.alive, weapon: p.weapon,
    ammo: p.ammo, reloading: p.reloading,
    kills: p.kills, deaths: p.deaths, ping: p.ping,
    spinAngle: p.spinAngle,
    shielded: now < p.shieldUntil,
    shieldLeft: Math.max(0, p.shieldUntil - now),
    cheats: {
      antiAim: p.cheats.antiAim, fakeLag: p.cheats.fakeLag,
      spinbot: p.cheats.spinbot, radarHack: p.cheats.radarHack,
      skin: p.cheats.skin, trail: p.cheats.trail
    }
  }));
  io.to(state.id).emit('game_state', {
    players,
    bullets: state.bullets.map(b => ({ x:b.x, y:b.y, trail:b.trail, weaponName:b.weaponName })),
    roundTime: state.roundTime, roundPhase: state.roundPhase,
    roundNum: state.roundNum, tScore: state.tScore, ctScore: state.ctScore,
    killFeed: state.killFeed
  });
}

// ===== SOCKET.IO =====
io.on('connection', socket => {
  console.log(`[+] ${socket.id} via ${socket.conn.transport.name}`);
  let currentRoomId = null;

  // Log transport upgrades
  socket.conn.on('upgrade', transport => {
    console.log(`[~] ${socket.id} upgraded to ${transport.name}`);
  });

  socket.on('get_rooms',      cb => { if (typeof cb==='function') cb(getRoomList()); });
  socket.on('get_leaderboard',cb => { if (typeof cb==='function') cb(loadLeaderboard()); });

  socket.on('create_room', (data, cb) => {
    if (!data) { if(typeof cb==='function') cb({ error:'No data' }); return; }
    const { roomName, nickname } = data;
    if (!nickname || nickname.length < 3 || nickname.length > 16) {
      if (typeof cb==='function') cb({ error:'Invalid nickname' });
      return;
    }
    const state = createRoom((roomName||'Lego Arena Server').substring(0,32));
    currentRoomId = state.id;
    socket.join(state.id);
    if (state.emptyTimer) { clearTimeout(state.emptyTimer); state.emptyTimer = null; }
    socket.emit('map_data', { map:MAP_DATA, tileSize:TILE_SIZE, mapW:MAP_W, mapH:MAP_H });
    socket.emit('choose_team', { roomId: state.id, tCount:0, ctCount:0 });
    if (typeof cb==='function') cb({ roomId: state.id });
  });

  socket.on('join_room', (data, cb) => {
    if (!data) { if(typeof cb==='function') cb({ error:'No data' }); return; }
    const { roomId, nickname } = data;
    if (!nickname || nickname.length < 3 || nickname.length > 16) {
      if (typeof cb==='function') cb({ error:'Invalid nickname' });
      return;
    }
    const state = rooms.get(roomId);
    if (!state) { if(typeof cb==='function') cb({ error:'Room not found' }); return; }
    if (state.players.size >= MAX_PLAYERS) { if(typeof cb==='function') cb({ error:'Room full' }); return; }
    if (currentRoomId) doLeave(socket);
    currentRoomId = roomId;
    socket.join(roomId);
    if (state.emptyTimer) { clearTimeout(state.emptyTimer); state.emptyTimer = null; }
    const tC = countTeam(state,'T'), ctC = countTeam(state,'CT');
    socket.emit('map_data', { map:MAP_DATA, tileSize:TILE_SIZE, mapW:MAP_W, mapH:MAP_H });
    socket.emit('choose_team', { roomId, tCount:tC, ctCount:ctC });
    if (typeof cb==='function') cb({ roomId });
  });

  socket.on('select_team', (data, cb) => {
    if (!data) { if(typeof cb==='function') cb({ error:'No data' }); return; }
    const { team, nickname } = data;
    if (!currentRoomId) { if(typeof cb==='function') cb({ error:'Not in room' }); return; }
    const state = rooms.get(currentRoomId);
    if (!state) { if(typeof cb==='function') cb({ error:'Room gone' }); return; }
    if (state.players.has(socket.id)) { if(typeof cb==='function') cb({ ok:true }); return; }
    const t = team === 'T' ? 'T' : 'CT';
    const cnt = countTeam(state, t);
    if (cnt >= MAX_PER_TEAM) {
      if(typeof cb==='function') cb({ error: `Team ${t} is full (max ${MAX_PER_TEAM})` });
      return;
    }
    const player = createPlayer(socket.id, nickname, t);
    state.players.set(socket.id, player);
    io.to(currentRoomId).emit('chat_message', {
      nickname:'SYSTEM', text:`${nickname} joined team ${t}`, system:true, t:Date.now()
    });
    socket.emit('joined_room', { roomId:currentRoomId, playerId:socket.id, team:t, nickname });
    if(typeof cb==='function') cb({ ok:true, team:t });
    console.log(`[Room ${currentRoomId}] ${nickname} joined as ${t}`);
  });

  function doLeave(sock) {
    if (!currentRoomId) return;
    const state = rooms.get(currentRoomId);
    if (!state) { currentRoomId=null; return; }
    const p = state.players.get(sock.id);
    if (p) {
      io.to(currentRoomId).emit('chat_message', {
        nickname:'SYSTEM', text:`${p.nickname} left`, system:true, t:Date.now()
      });
      state.players.delete(sock.id);
    }
    sock.leave(currentRoomId);
    if (state.players.size === 0) {
      state.emptyTimer = setTimeout(() => deleteRoom(currentRoomId), 60000);
    }
    console.log(`[Room ${currentRoomId}] player left (${state.players.size} left)`);
    currentRoomId = null;
  }

  socket.on('leave_room', () => doLeave(socket));

  socket.on('player_input', input => {
    if (!input || !currentRoomId) return;
    const state = rooms.get(currentRoomId);
    if (!state) return;
    const player = state.players.get(socket.id);
    if (!player || !player.alive) return;

    const now = Date.now();
    const wep = WEAPONS[player.weapon];

    let speed = PLAYER_SPEED;
    if (player.cheats.bhop)    speed = Math.min(PLAYER_SPEED * 1.12, speed * 1.12);
    if (player.cheats.spinbot) speed *= 0.85;

    const dx = (input.right?1:0)-(input.left?1:0);
    const dy = (input.down?1:0)-(input.up?1:0);
    const len = Math.sqrt(dx*dx+dy*dy)||1;
    if (dx||dy) {
      const mx=(dx/len)*speed, my=(dy/len)*speed;
      let nx=player.x, ny=player.y;
      if (canMove(player.x+mx, player.y,   PLAYER_RADIUS)) nx = player.x+mx;
      if (canMove(nx,          player.y+my, PLAYER_RADIUS)) ny = player.y+my;
      player.x=nx; player.y=ny;
    }

    player.angle = input.angle || 0;

    if (input.cheats) {
      Object.assign(player.cheats, {
        antiAim:    !!input.cheats.antiAim,
        fakeLag:    !!input.cheats.fakeLag,
        spinbot:    !!input.cheats.spinbot,
        spinSpeed:  Math.max(1, Math.min(20, input.cheats.spinSpeed||10)),
        bhop:       !!input.cheats.bhop,
        noRecoil:   !!input.cheats.noRecoil,
        radarHack:  !!input.cheats.radarHack,
        skin:       Math.max(0, Math.min(7, input.cheats.skin||0)),
        trail:      Math.max(0, Math.min(3, input.cheats.trail||0))
      });
    }

    if (input.weapon && WEAPONS[input.weapon] && input.weapon !== player.weapon) {
      player.weapon = input.weapon;
      player.ammo = WEAPONS[input.weapon].magSize;
      player.reloading = false;
    }

    if (input.reload && !player.reloading && player.ammo < wep.magSize) {
      player.reloading = true;
      player.reloadEnd = now + wep.reloadTime;
    }

    if (input.shoot && !player.reloading && player.ammo > 0 && now - player.lastShot >= wep.fireRate) {
      player.lastShot = now;
      player.ammo--;

      let spread = player.cheats.noRecoil ? 0.02 : wep.spread;
      let bulletAngle = player.angle + (Math.random()-0.5)*spread*2;

      if (input.cheats && input.cheats.aimbot) {
        let closest=null, closestDist=Infinity;
        const fovRad = Math.max(0.05, (input.cheats.aimbotFOV||60) / 2) * Math.PI / 180;
        state.players.forEach(t => {
          if (t.id===socket.id||t.team===player.team||!t.alive) return;
          const ddx=t.x-player.x, ddy=t.y-player.y;
          const dist=Math.hypot(ddx,ddy);
          if (dist < 1) return;
          const ta=Math.atan2(ddy,ddx);
          let diff = ta - player.angle;
          while (diff >  Math.PI) diff -= Math.PI*2;
          while (diff < -Math.PI) diff += Math.PI*2;
          if (Math.abs(diff) > fovRad) return;
          if (!hasLOS(player.x,player.y,t.x,t.y)) return;
          if (dist < closestDist){ closestDist=dist; closest=t; }
        });
        if (closest) {
          bulletAngle = Math.atan2(closest.y-player.y, closest.x-player.x);
          const minSpread = player.cheats.noRecoil ? 0.005 : 0.015;
          bulletAngle += (Math.random()-0.5) * minSpread;
        }
      }

      state.bullets.push({
        ownerId: socket.id, ownerTeam: player.team,
        x: player.x, y: player.y, angle: bulletAngle,
        damage: wep.damage, weaponName: wep.name,
        dist: 0, trail: player.cheats.trail||0
      });

      if (player.ammo === 0) { player.reloading=true; player.reloadEnd=now+wep.reloadTime; }
    }
  });

  socket.on('chat_message', text => {
    if (!currentRoomId) return;
    const state = rooms.get(currentRoomId);
    if (!state) return;
    const player = state.players.get(socket.id);
    if (!player) return;
    const now = Date.now();

    if (now < player.chatMutedUntil) {
      socket.emit('chat_message', {
        nickname:'SYSTEM',
        text:`Muted for ${Math.ceil((player.chatMutedUntil-now)/1000)}s`,
        system:true, t:now
      });
      return;
    }

    const trimmed = (text||'').trim().substring(0,200);
    if (!trimmed) return;

    if (trimmed === '/night') { socket.emit('local_cmd', { cmd:'night' }); return; }
    if (trimmed === '/day')   { socket.emit('local_cmd', { cmd:'day' });   return; }

    player.chatLog = player.chatLog.filter(t => now-t < 10000);
    if (player.chatLog.length >= 3) {
      player.chatMutedUntil = now+30000;
      socket.emit('chat_message', { nickname:'SYSTEM', text:'Muted 30s (spam)', system:true, t:now });
      return;
    }
    if (trimmed === player.lastChatMsg) {
      socket.emit('chat_message', { nickname:'SYSTEM', text:'No duplicate messages', system:true, t:now });
      return;
    }
    player.chatLog.push(now);
    player.lastChatMsg = trimmed;
    io.to(currentRoomId).emit('chat_message', {
      nickname:player.nickname, text:filterMessage(trimmed),
      team:player.team, system:false, t:now
    });
  });

  // Ping — safe callback check
  socket.on('ping_check', (t, cb) => {
    if (typeof cb === 'function') {
      try { cb(t); } catch(e) {}
    }
  });

  socket.on('update_ping', ping => {
    if (!currentRoomId) return;
    const s = rooms.get(currentRoomId);
    if (!s) return;
    const p = s.players.get(socket.id);
    if (p) p.ping = Math.min(999, Math.max(0, ping|0));
  });

  socket.on('disconnect', (reason) => {
    console.log(`[-] ${socket.id} (${reason})`);
    doLeave(socket);
  });

  socket.on('error', err => {
    console.error(`[ERR] ${socket.id}:`, err.message);
  });
});

// ===== START =====
ensureDataDir();
const PORT = process.env.PORT || 3000;

// Bind to 0.0.0.0 — required for hosting (not just localhost)
server.listen(PORT, '0.0.0.0', () => {
  console.log(`\n╔══════════════════════════════════════╗`);
  console.log(`║  CS:GO ONLINE - CHEAT SERVER v6      ║`);
  console.log(`║  Port: ${PORT}                          ║`);
  console.log(`║  http://localhost:${PORT}               ║`);
  console.log(`╚══════════════════════════════════════╝\n`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('[Server] SIGTERM received, shutting down...');
  server.close(() => process.exit(0));
});
process.on('SIGINT', () => {
  console.log('[Server] SIGINT received, shutting down...');
  server.close(() => process.exit(0));
});
