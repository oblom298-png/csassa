/**
 * CS:GO ONLINE - CHEAT  Server v8.0
 * Improvements: password-protected rooms, better hit reg,
 * bug fixes, leaderboard persistence, building tiles (type 5)
 */

const express = require('express');
const http    = require('http');
const { Server } = require('socket.io');
const fs   = require('fs');
const path = require('path');

const app    = express();
const server = http.createServer(app);

/* ── Socket.IO ─────────────────────────────────────────────────── */
const io = new Server(server, {
  cors: { origin: '*', methods: ['GET','POST','OPTIONS'] },
  transports: ['polling', 'websocket'],
  allowUpgrades: true,
  upgradeTimeout: 30000,
  pingTimeout:    60000,
  pingInterval:   25000,
  cookie: false,
  allowEIO3: true,
  maxHttpBufferSize: 1e6
});

/* ── Express ────────────────────────────────────────────────────── */
app.set('trust proxy', 1);
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') { res.sendStatus(200); return; }
  next();
});
app.use(express.static(path.join(__dirname, 'public')));
app.get('/health', (_req, res) =>
  res.json({ status: 'ok', rooms: rooms.size, uptime: Math.floor(process.uptime()) })
);
app.get('/', (_req, res) =>
  res.sendFile(path.join(__dirname, 'public', 'index.html'))
);

/* ── CONSTANTS ──────────────────────────────────────────────────── */
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
const PLAYER_RADIUS = 11;   // slightly smaller for better feel
const BULLET_SPEED  = 16;   // faster bullets = better hit reg
const BULLET_RADIUS = 5;    // bullet hitbox radius
const RESPAWN_TIME  = 3000;
const SHIELD_TIME   = 5000;

const WEAPONS = {
  pistol: { damage:18, fireRate:380,  magSize:12, reloadTime:1200, spread:0.07, name:'Pistol' },
  ak:     { damage:25, fireRate:95,   magSize:30, reloadTime:2200, spread:0.05, name:'AK'     },
  awp:    { damage:95, fireRate:1400, magSize:5,  reloadTime:2800, spread:0.01, name:'AWP'    }
};

/* ── MAP ────────────────────────────────────────────────────────── */
// Tile legend:
// 0 = floor, 1 = solid wall, 2 = T spawn, 3 = CT spawn
// 4 = cover box, 5 = building wall (decorative solid, drawn differently)
const MAP_DATA = [
  [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
  [1,2,2,0,0,0,0,0,0,0,5,5,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,5,5,0,0,0,0,0,0,3,3,3,1],
  [1,2,2,0,0,0,0,0,0,0,5,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,5,0,0,0,0,0,0,0,3,3,1],
  [1,0,0,4,4,0,0,0,0,0,0,0,0,0,4,0,0,0,0,0,0,0,0,0,0,4,0,0,0,0,0,0,0,0,0,4,4,0,0,1],
  [1,0,0,4,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,4,0,0,1],
  [1,0,0,0,0,0,0,5,5,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,5,5,0,0,0,0,0,0,0,0,0,1],
  [1,0,0,0,0,0,0,5,0,0,0,0,0,4,4,4,0,0,0,0,0,4,4,4,0,0,0,0,0,5,0,0,0,0,0,0,0,0,0,1],
  [1,0,0,0,0,0,0,0,0,0,0,0,0,4,0,4,0,0,0,0,0,4,0,4,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
  [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
  [1,5,5,0,0,0,0,0,0,0,0,0,0,0,0,0,0,4,4,0,0,4,4,0,0,0,0,0,0,0,0,0,0,0,0,0,5,5,5,1],
  [1,5,0,0,0,0,0,0,0,0,4,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,4,0,0,0,0,0,0,0,0,0,0,5,5,1],
  [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
  [1,0,0,0,0,0,5,5,0,0,0,0,0,0,0,4,4,0,0,4,4,0,0,0,0,0,0,0,5,5,0,0,0,0,0,0,0,0,0,1],
  [1,0,0,4,0,0,5,0,0,0,0,0,0,0,0,4,0,0,0,0,4,0,0,0,0,0,0,0,0,5,0,0,0,0,4,0,0,0,0,1],
  [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
  [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,4,0,0,0,4,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
  [1,0,0,4,0,0,0,0,0,0,0,0,0,0,0,4,0,0,0,0,0,0,4,0,0,0,0,0,0,0,0,0,0,0,4,0,0,0,0,1],
  [1,0,0,0,0,0,5,5,0,0,0,0,0,0,0,4,4,0,0,4,4,0,0,0,0,0,0,0,5,5,0,0,0,0,0,0,0,0,0,1],
  [1,0,0,0,0,0,5,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,5,0,0,0,0,0,0,0,0,0,1],
  [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
  [1,5,5,0,0,0,0,0,0,0,4,0,0,0,0,0,0,0,0,0,0,0,0,0,0,4,0,0,0,0,0,0,0,0,0,0,5,5,5,1],
  [1,5,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,4,4,0,0,4,4,0,0,0,0,0,0,0,0,0,0,0,0,0,0,5,5,1],
  [1,0,0,0,0,0,0,0,0,0,0,0,0,4,0,4,0,0,0,0,0,0,0,4,0,4,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
  [1,0,0,0,0,0,0,5,0,0,0,0,0,4,4,4,0,0,0,0,0,4,4,4,0,0,0,0,5,0,0,0,0,0,0,0,0,0,0,1],
  [1,0,0,4,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,4,0,0,0,0,1],
  [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
  [1,2,2,0,0,0,0,0,0,0,5,5,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,5,5,0,0,0,0,0,0,3,3,3,1],
  [1,2,0,0,0,0,0,0,0,0,5,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,5,0,0,0,0,0,0,0,3,3,1],
  [1,0,0,4,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,4,0,0,1],
  [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1]
];

// All solid tile types for collision
function isSolid(t) { return t===1||t===4||t===5; }

function getTile(x,y) {
  const tx=Math.floor(x/TILE_SIZE), ty=Math.floor(y/TILE_SIZE);
  if (tx<0||tx>=MAP_W||ty<0||ty>=MAP_H) return 1;
  return MAP_DATA[ty][tx];
}

function canMove(x,y,r) {
  const offsets = [
    {dx:-r, dy:-r},{dx:r,  dy:-r},{dx:-r, dy:r},{dx:r,  dy:r},
    {dx:0,  dy:-r},{dx:0,  dy:r}, {dx:-r, dy:0},{dx:r,  dy:0}
  ];
  for (const o of offsets)
    if (isSolid(getTile(x+o.dx, y+o.dy))) return false;
  return true;
}

// Ray-cast for line-of-sight (wall check for aimbot)
function hasLOS(ax,ay,bx,by) {
  const dx=bx-ax, dy=by-ay;
  const dist=Math.sqrt(dx*dx+dy*dy);
  if (!dist) return true;
  const nx=dx/dist, ny=dy/dist;
  let cx=ax, cy=ay;
  const steps=Math.ceil(dist/4); // check every 4px
  for (let i=0;i<steps;i++) {
    cx+=nx*4; cy+=ny*4;
    const d2=Math.hypot(cx-ax,cy-ay);
    if (d2>=dist) break;
    if (isSolid(getTile(cx,cy))) return false;
  }
  return true;
}

function getSpawnPoints(team) {
  const pts = [];
  for (let y = 0; y < MAP_H; y++)
    for (let x = 0; x < MAP_W; x++) {
      if (team==='T'  && MAP_DATA[y][x]===2) pts.push({x:x*TILE_SIZE+16, y:y*TILE_SIZE+16});
      if (team==='CT' && MAP_DATA[y][x]===3) pts.push({x:x*TILE_SIZE+16, y:y*TILE_SIZE+16});
    }
  return pts;
}
function randomSpawn(team) {
  const pts = getSpawnPoints(team);
  if (!pts.length) return {x:64,y:64};
  return pts[Math.floor(Math.random()*pts.length)];
}

/* ── CHAT FILTER ────────────────────────────────────────────────── */
const BAD_WORDS = [
  'fuck','shit','ass','bitch','cunt','dick','pussy','nigger','faggot','retard',
  'whore','slut','bastard','cock','prick','twat','wank',
  'хуй','пизда','блядь','ёбаный','еб','сука','мудак','пиздец','ублюдок',
  'залупа','шлюха','манда','уёбок','курва'
];
const URL_RE = /https?:\/\/|www\.|\.(com|ru|net|org|io|gg)/gi;
function filterMsg(text) {
  let f = text;
  for (const w of BAD_WORDS) f = f.replace(new RegExp(w,'gi'),'***');
  return f.replace(URL_RE,'***');
}

/* ── LEADERBOARD ────────────────────────────────────────────────── */
const LB_DIR  = path.join(__dirname,'data');
const LB_PATH = path.join(LB_DIR,'leaderboard.json');

function ensureDataDir() {
  if (!fs.existsSync(LB_DIR))  fs.mkdirSync(LB_DIR,{recursive:true});
  if (!fs.existsSync(LB_PATH)) fs.writeFileSync(LB_PATH,'[]','utf8');
}
function loadLB() {
  try {
    const raw = fs.readFileSync(LB_PATH,'utf8');
    const d = JSON.parse(raw);
    return Array.isArray(d) ? d : [];
  } catch(e) { return []; }
}
function saveLB(lb) {
  try {
    const tmp = LB_PATH+'.tmp';
    fs.writeFileSync(tmp, JSON.stringify(lb,null,2), 'utf8');
    fs.renameSync(tmp, LB_PATH);
  } catch(e) {
    try { fs.writeFileSync(LB_PATH, JSON.stringify(lb,null,2), 'utf8'); } catch(_){}
  }
}
function updateLB(nick,kills,deaths) {
  const lb = loadLB();
  let e = lb.find(x=>x.nickname===nick);
  if (!e) { e={nickname:nick,kills:0,deaths:0}; lb.push(e); }
  e.kills+=kills; e.deaths+=deaths;
  lb.sort((a,b)=>b.kills-a.kills);
  saveLB(lb.slice(0,50));
}

/* ── ROOMS ──────────────────────────────────────────────────────── */
const rooms = new Map();
let roomIdCounter = 1;

function createRoom(name, password) {
  const id = 'room_'+(roomIdCounter++);
  const state = {
    id, name,
    password: password||'',        // empty = no password
    players: new Map(),
    bullets: [],
    roundTime: ROUND_TIME,
    roundPhase: 'play',
    roundNum: 1,
    tScore: 0, ctScore: 0,
    lastTick: Date.now(),
    tickInterval: null,
    emptyTimer: null,
    killFeed: []
  };
  state.tickInterval = setInterval(()=>{
    const now=Date.now();
    const dt=(now-state.lastTick)/1000;
    state.lastTick=now;
    gameTick(state,dt,now);
  }, TICK_MS);
  rooms.set(id,state);
  console.log(`[Room+] "${name}" (${id}) pwd=${!!password}`);
  return state;
}
function deleteRoom(id) {
  const s=rooms.get(id); if(!s) return;
  clearInterval(s.tickInterval); clearTimeout(s.emptyTimer);
  rooms.delete(id);
  console.log(`[Room-] ${id}`);
}
function getRoomList() {
  return [...rooms.values()].map(r=>{
    let tC=0,ctC=0;
    r.players.forEach(p=>p.team==='T'?tC++:ctC++);
    return {
      id:r.id, name:r.name,
      playerCount:r.players.size, maxPlayers:MAX_PLAYERS,
      tCount:tC, ctCount:ctC,
      roundNum:r.roundNum, phase:r.roundPhase,
      hasPassword:!!r.password   // tell client if password protected
    };
  });
}
function countTeam(state,team) {
  let c=0; state.players.forEach(p=>{if(p.team===team)c++;}); return c;
}
function createPlayer(sid,nickname,team) {
  const sp=randomSpawn(team);
  return {
    id:sid, nickname, team,
    x:sp.x, y:sp.y, angle:0,
    hp:100, alive:true,
    shieldUntil:Date.now()+SHIELD_TIME,
    weapon:'pistol', ammo:WEAPONS.pistol.magSize,
    reloading:false, reloadEnd:0, lastShot:0,
    kills:0, deaths:0, respawnAt:0, ping:0,
    cheats:{
      aimbot:false, aimbotSmooth:5, aimbotFOV:60,
      antiAim:false, fakeLag:false,
      spinbot:false, spinSpeed:10,
      bhop:false, noRecoil:false, radarHack:false,
      skin:0, trail:0
    },
    spinAngle:0,
    chatLog:[], chatMutedUntil:0, lastChatMsg:''
  };
}

/* ── GAME TICK ──────────────────────────────────────────────────── */
function gameTick(state,dt,now) {
  if (state.roundPhase==='between') {
    state.roundTime-=dt;
    if (state.roundTime<=0) startNewRound(state,now);
    broadcastState(state,now); return;
  }
  state.roundTime-=dt;
  if (state.roundTime<=0) { endRound(state,now); return; }

  state.players.forEach(p=>{
    if (!p.alive) {
      if (now>=p.respawnAt&&p.respawnAt>0) respawnPlayer(p,now);
      return;
    }
    if (p.cheats.spinbot) p.spinAngle+=p.cheats.spinSpeed*5*Math.PI/180;
    if (p.reloading&&now>=p.reloadEnd) {
      p.reloading=false; p.ammo=WEAPONS[p.weapon].magSize;
    }
  });

  // ── BULLET PROCESSING (improved hit reg) ──────────────────────
  const kept=[];
  for (const b of state.bullets) {
    // Sub-step movement for fast bullets — prevents tunnelling
    const steps=3;
    const stepX=Math.cos(b.angle)*BULLET_SPEED/steps;
    const stepY=Math.sin(b.angle)*BULLET_SPEED/steps;
    let hitWall=false, hitPlayer=false;

    for (let s=0;s<steps&&!hitWall&&!hitPlayer;s++) {
      b.x+=stepX; b.y+=stepY;
      b.dist+=BULLET_SPEED/steps;
      if (b.dist>1100) { hitWall=true; break; }
      if (isSolid(getTile(b.x,b.y))) { hitWall=true; break; }

      // Check all enemy players
      state.players.forEach(t=>{
        if (hitPlayer||hitWall) return;
        if (t.id===b.ownerId||!t.alive||t.team===b.ownerTeam) return;
        if (now<t.shieldUntil) return;
        // Circle-circle collision: bullet radius + player radius
        if (Math.hypot(t.x-b.x, t.y-b.y) < PLAYER_RADIUS+BULLET_RADIUS) {
          hitPlayer=true;
          applyDamage(state, b.ownerId, t, b.damage, b.weaponName, now);
        }
      });
    }

    if (!hitWall&&!hitPlayer) kept.push(b);
  }
  state.bullets=kept;
  broadcastState(state,now);
}

function applyDamage(state,attackerId,target,damage,weaponName,now) {
  target.hp=Math.max(0, target.hp-damage);
  if (target.hp>0) return;
  target.alive=false; target.deaths++;
  target.respawnAt=now+RESPAWN_TIME;
  const att=state.players.get(attackerId); if (!att) return;
  att.kills++;
  if (att.team==='T') state.tScore++; else state.ctScore++;
  const kill={killer:att.nickname,victim:target.nickname,weapon:weaponName,t:now};
  state.killFeed.push(kill);
  if (state.killFeed.length>5) state.killFeed.shift();
  updateLB(att.nickname,1,0);
  updateLB(target.nickname,0,1);
  io.to(state.id).emit('kill_event',kill);
}

function respawnPlayer(p,now) {
  const sp=randomSpawn(p.team);
  p.x=sp.x; p.y=sp.y;
  p.hp=100; p.alive=true;
  p.shieldUntil=now+SHIELD_TIME;
  p.ammo=WEAPONS[p.weapon].magSize;
  p.reloading=false; p.respawnAt=0;
}
function endRound(state,now) {
  let winner='Draw';
  if (state.tScore>state.ctScore) winner='Terrorists';
  else if (state.ctScore>state.tScore) winner='Counter-Terrorists';
  state.roundPhase='between'; state.roundTime=BETWEEN_ROUND;
  io.to(state.id).emit('round_end',{
    winner, tScore:state.tScore, ctScore:state.ctScore, roundNum:state.roundNum
  });
}
function startNewRound(state,now) {
  state.roundNum++; state.roundPhase='play'; state.roundTime=ROUND_TIME;
  state.bullets=[]; state.killFeed=[];
  state.players.forEach(p=>respawnPlayer(p,now));
  io.to(state.id).emit('round_start',{
    roundNum:state.roundNum, tScore:state.tScore, ctScore:state.ctScore
  });
}
function broadcastState(state,now) {
  const players=[];
  state.players.forEach(p=>players.push({
    id:p.id, nickname:p.nickname, team:p.team,
    x:p.x, y:p.y, angle:p.angle,
    hp:p.hp, alive:p.alive, weapon:p.weapon,
    ammo:p.ammo, reloading:p.reloading,
    kills:p.kills, deaths:p.deaths, ping:p.ping,
    spinAngle:p.spinAngle,
    shielded:now<p.shieldUntil,
    shieldLeft:Math.max(0,p.shieldUntil-now),
    cheats:{
      antiAim:p.cheats.antiAim, fakeLag:p.cheats.fakeLag,
      spinbot:p.cheats.spinbot,  radarHack:p.cheats.radarHack,
      skin:p.cheats.skin,        trail:p.cheats.trail
    }
  }));
  io.to(state.id).emit('game_state',{
    players,
    bullets:state.bullets.map(b=>({x:b.x,y:b.y,trail:b.trail,weaponName:b.weaponName})),
    roundTime:state.roundTime, roundPhase:state.roundPhase,
    roundNum:state.roundNum,   tScore:state.tScore, ctScore:state.ctScore,
    killFeed:state.killFeed
  });
}

/* ── SOCKET.IO HANDLERS ─────────────────────────────────────────── */
io.on('connection', socket => {
  console.log(`[+] ${socket.id} transport=${socket.conn.transport.name}`);
  let currentRoomId = null;

  socket.conn.on('upgrade', t => console.log(`[~] ${socket.id} -> ${t.name}`));

  socket.on('get_rooms', cb => {
    if (typeof cb==='function') cb(getRoomList());
  });
  socket.on('get_leaderboard', cb => {
    if (typeof cb==='function') cb(loadLB());
  });

  // Create room — now accepts optional password
  socket.on('create_room', (data,cb) => {
    if (!data||typeof data!=='object') { safe(cb,{error:'Bad data'}); return; }
    const { roomName, nickname, password } = data;
    if (!validNick(nickname)) { safe(cb,{error:'Invalid nickname (3-16 chars)'}); return; }
    const pwd = (typeof password==='string' ? password.trim() : '').substring(0,20);
    const state = createRoom((roomName||'Lego Arena').substring(0,32), pwd);
    currentRoomId = state.id;
    socket.join(state.id);
    if (state.emptyTimer) { clearTimeout(state.emptyTimer); state.emptyTimer=null; }
    socket.emit('map_data',{map:MAP_DATA, tileSize:TILE_SIZE, mapW:MAP_W, mapH:MAP_H});
    socket.emit('choose_team',{roomId:state.id, tCount:0, ctCount:0});
    safe(cb,{roomId:state.id});
  });

  // Join room — validates password
  socket.on('join_room', (data,cb) => {
    if (!data||typeof data!=='object') { safe(cb,{error:'Bad data'}); return; }
    const { roomId, nickname, password } = data;
    if (!validNick(nickname)) { safe(cb,{error:'Invalid nickname'}); return; }
    const state = rooms.get(roomId);
    if (!state) { safe(cb,{error:'Room not found'}); return; }
    if (state.players.size>=MAX_PLAYERS) { safe(cb,{error:'Room full'}); return; }
    // Password check
    if (state.password) {
      const entered = (typeof password==='string' ? password.trim() : '');
      if (entered!==state.password) { safe(cb,{error:'Wrong password'}); return; }
    }
    if (currentRoomId) doLeave(socket);
    currentRoomId = roomId;
    socket.join(roomId);
    if (state.emptyTimer) { clearTimeout(state.emptyTimer); state.emptyTimer=null; }
    const tC=countTeam(state,'T'), ctC=countTeam(state,'CT');
    socket.emit('map_data',{map:MAP_DATA, tileSize:TILE_SIZE, mapW:MAP_W, mapH:MAP_H});
    socket.emit('choose_team',{roomId, tCount:tC, ctCount:ctC});
    safe(cb,{roomId});
  });

  socket.on('select_team', (data,cb) => {
    if (!data||typeof data!=='object') { safe(cb,{error:'Bad data'}); return; }
    const { team, nickname } = data;
    if (!currentRoomId) { safe(cb,{error:'Not in room'}); return; }
    const state = rooms.get(currentRoomId);
    if (!state) { safe(cb,{error:'Room gone'}); return; }
    if (state.players.has(socket.id)) { safe(cb,{ok:true}); return; }
    const t = team==='T'?'T':'CT';
    if (countTeam(state,t)>=MAX_PER_TEAM) { safe(cb,{error:`Team ${t} full`}); return; }
    const player = createPlayer(socket.id, nickname||'Player', t);
    state.players.set(socket.id, player);
    io.to(currentRoomId).emit('chat_message',{
      nickname:'SYSTEM', text:`${player.nickname} joined ${t}`, system:true, t:Date.now()
    });
    socket.emit('joined_room',{
      roomId:currentRoomId, playerId:socket.id, team:t, nickname:player.nickname
    });
    safe(cb,{ok:true,team:t});
  });

  function doLeave(sock) {
    if (!currentRoomId) return;
    const state = rooms.get(currentRoomId);
    if (state) {
      const p=state.players.get(sock.id);
      if (p) {
        io.to(currentRoomId).emit('chat_message',{
          nickname:'SYSTEM', text:`${p.nickname} left`, system:true, t:Date.now()
        });
        state.players.delete(sock.id);
      }
      sock.leave(currentRoomId);
      if (state.players.size===0)
        state.emptyTimer=setTimeout(()=>deleteRoom(currentRoomId),60000);
    }
    currentRoomId=null;
  }

  socket.on('leave_room', ()=>doLeave(socket));

  socket.on('player_input', input => {
    if (!input||!currentRoomId) return;
    const state=rooms.get(currentRoomId); if (!state) return;
    const player=state.players.get(socket.id); if (!player||!player.alive) return;
    const now=Date.now();
    const wep=WEAPONS[player.weapon];

    // Movement with diagonal normalisation
    let speed=PLAYER_SPEED;
    if (player.cheats.bhop)    speed=Math.min(PLAYER_SPEED*1.12, speed*1.12);
    if (player.cheats.spinbot) speed*=0.85;
    const dx=(input.right?1:0)-(input.left?1:0);
    const dy=(input.down?1:0)-(input.up?1:0);
    if (dx||dy) {
      const len=Math.sqrt(dx*dx+dy*dy);
      const mx=(dx/len)*speed, my=(dy/len)*speed;
      let nx=player.x, ny=player.y;
      if (canMove(player.x+mx, player.y,   PLAYER_RADIUS)) nx=player.x+mx;
      if (canMove(nx,           player.y+my, PLAYER_RADIUS)) ny=player.y+my;
      player.x=nx; player.y=ny;
    }

    player.angle=input.angle||0;

    // Sync cheat flags from client
    if (input.cheats&&typeof input.cheats==='object') {
      Object.assign(player.cheats,{
        antiAim:  !!input.cheats.antiAim,
        fakeLag:  !!input.cheats.fakeLag,
        spinbot:  !!input.cheats.spinbot,
        spinSpeed: Math.max(1,Math.min(20,input.cheats.spinSpeed||10)),
        bhop:     !!input.cheats.bhop,
        noRecoil: !!input.cheats.noRecoil,
        radarHack:!!input.cheats.radarHack,
        skin:  Math.max(0,Math.min(7,input.cheats.skin||0)),
        trail: Math.max(0,Math.min(3,input.cheats.trail||0))
      });
    }

    // Weapon switch
    if (input.weapon&&WEAPONS[input.weapon]&&input.weapon!==player.weapon) {
      player.weapon=input.weapon;
      player.ammo=WEAPONS[input.weapon].magSize;
      player.reloading=false;
    }

    // Reload
    if (input.reload&&!player.reloading&&player.ammo<wep.magSize) {
      player.reloading=true;
      player.reloadEnd=now+wep.reloadTime;
    }

    // Shoot
    if (input.shoot&&!player.reloading&&player.ammo>0&&now-player.lastShot>=wep.fireRate) {
      player.lastShot=now;
      player.ammo--;
      let spread = player.cheats.noRecoil ? 0.015 : wep.spread;
      let bAngle = player.angle+(Math.random()-0.5)*spread*2;

      // Server-side aimbot assist
      if (input.cheats&&input.cheats.aimbot) {
        const fovRad=Math.max(0.05,(input.cheats.aimbotFOV||60)/2)*Math.PI/180;
        let closest=null, closestDist=Infinity;
        state.players.forEach(t=>{
          if (t.id===socket.id||t.team===player.team||!t.alive) return;
          const ddx=t.x-player.x, ddy=t.y-player.y;
          const dist=Math.hypot(ddx,ddy); if (dist<1) return;
          const ta=Math.atan2(ddy,ddx);
          let diff=ta-player.angle;
          while(diff> Math.PI) diff-=Math.PI*2;
          while(diff<-Math.PI) diff+=Math.PI*2;
          if (Math.abs(diff)>fovRad) return;
          if (!hasLOS(player.x,player.y,t.x,t.y)) return;
          if (dist<closestDist){closestDist=dist;closest=t;}
        });
        if (closest) {
          bAngle=Math.atan2(closest.y-player.y,closest.x-player.x);
          bAngle+=(Math.random()-0.5)*(player.cheats.noRecoil?0.004:0.012);
        }
      }

      state.bullets.push({
        ownerId:socket.id, ownerTeam:player.team,
        x:player.x, y:player.y,
        angle:bAngle,
        damage:wep.damage,
        weaponName:wep.name,
        dist:0,
        trail:player.cheats.trail||0
      });
      if (player.ammo===0) {
        player.reloading=true;
        player.reloadEnd=now+wep.reloadTime;
      }
    }
  });

  socket.on('chat_message', text => {
    if (!currentRoomId) return;
    const state=rooms.get(currentRoomId); if (!state) return;
    const player=state.players.get(socket.id); if (!player) return;
    const now=Date.now();
    if (now<player.chatMutedUntil) {
      socket.emit('chat_message',{
        nickname:'SYSTEM',
        text:`Muted ${Math.ceil((player.chatMutedUntil-now)/1000)}s`,
        system:true, t:now
      });
      return;
    }
    const trimmed=(text||'').trim().substring(0,200);
    if (!trimmed) return;
    if (trimmed==='/night') { socket.emit('local_cmd',{cmd:'night'}); return; }
    if (trimmed==='/day')   { socket.emit('local_cmd',{cmd:'day'});   return; }
    player.chatLog=player.chatLog.filter(t=>now-t<10000);
    if (player.chatLog.length>=3) {
      player.chatMutedUntil=now+30000;
      socket.emit('chat_message',{nickname:'SYSTEM',text:'Muted 30s (spam)',system:true,t:now});
      return;
    }
    if (trimmed===player.lastChatMsg) {
      socket.emit('chat_message',{nickname:'SYSTEM',text:'No duplicate messages',system:true,t:now});
      return;
    }
    player.chatLog.push(now); player.lastChatMsg=trimmed;
    io.to(currentRoomId).emit('chat_message',{
      nickname:player.nickname,
      text:filterMsg(trimmed),
      team:player.team, system:false, t:now
    });
  });

  socket.on('ping_check', (t,cb) => {
    if (typeof cb==='function') { try{cb(t);}catch(e){} }
  });

  socket.on('update_ping', ping => {
    if (!currentRoomId) return;
    const s=rooms.get(currentRoomId); if (!s) return;
    const p=s.players.get(socket.id);
    if (p) p.ping=Math.min(999,Math.max(0,ping|0));
  });

  socket.on('disconnect', reason => {
    console.log(`[-] ${socket.id} (${reason})`);
    doLeave(socket);
  });
  socket.on('error', err => console.error(`[ERR] ${socket.id}:`,err.message));
});

/* ── HELPERS ────────────────────────────────────────────────────── */
function safe(cb, data) {
  if (typeof cb==='function') { try{cb(data);}catch(e){} }
}
function validNick(n) {
  return n && typeof n==='string' &&
    n.length>=3 && n.length<=16 &&
    /^[a-zA-Z0-9_А-Яа-яёЁ]+$/.test(n);
}

/* ── START ──────────────────────────────────────────────────────── */
ensureDataDir();
const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`\n╔══════════════════════════════════╗`);
  console.log(`║  CS:GO ONLINE — CHEAT  v8.0      ║`);
  console.log(`║  Listening on 0.0.0.0:${PORT}       ║`);
  console.log(`╚══════════════════════════════════╝\n`);
});

process.on('SIGTERM', ()=>server.close(()=>process.exit(0)));
process.on('SIGINT',  ()=>server.close(()=>process.exit(0)));
