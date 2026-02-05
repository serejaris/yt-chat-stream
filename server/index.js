import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 3000;
const isProd = process.env.NODE_ENV === 'production';

// --- Moderation config ---
const RATE_LIMIT_MAX = 5;        // max messages per window
const RATE_LIMIT_WINDOW = 10000; // 10 seconds
const SLOW_MODE_MS = 2000;       // 2 sec between messages
const MAX_MSG_LENGTH = 500;
const MIN_MSG_LENGTH = 1;
const MAX_CONNECTIONS_PER_IP = 3;

const app = express();
app.use(cors());

if (isProd) {
  app.use(express.static(join(__dirname, '..', 'client', 'dist')));
  app.get('*', (req, res) => {
    res.sendFile(join(__dirname, '..', 'client', 'dist', 'index.html'));
  });
}

const server = createServer(app);

const io = new Server(server, {
  cors: isProd
    ? undefined
    : { origin: 'http://localhost:5173', methods: ['GET', 'POST'] },
});

const users = new Map();      // socketId -> { name, joinedAt, ip, isMod, lastMsg, lastMsgText, msgTimestamps }
const ipConnections = new Map(); // ip -> count
let moderatorId = null;       // first user = moderator

function getIP(socket) {
  return socket.handshake.headers['x-forwarded-for']?.split(',')[0]?.trim()
    || socket.handshake.address;
}

function getUsersList() {
  return Array.from(users.entries()).map(([id, u]) => ({
    name: u.name,
    isMod: u.isMod,
  }));
}

function checkRateLimit(user) {
  const now = Date.now();
  user.msgTimestamps = user.msgTimestamps.filter((t) => now - t < RATE_LIMIT_WINDOW);
  if (user.msgTimestamps.length >= RATE_LIMIT_MAX) {
    return { ok: false, reason: `Too fast! Max ${RATE_LIMIT_MAX} messages per ${RATE_LIMIT_WINDOW / 1000}s` };
  }
  return { ok: true };
}

function checkSlowMode(user) {
  if (user.lastMsg && Date.now() - user.lastMsg < SLOW_MODE_MS) {
    const wait = Math.ceil((SLOW_MODE_MS - (Date.now() - user.lastMsg)) / 1000);
    return { ok: false, reason: `Slow mode: wait ${wait}s` };
  }
  return { ok: true };
}

function checkDuplicate(user, text) {
  if (user.lastMsgText && user.lastMsgText === text) {
    return { ok: false, reason: 'Duplicate message blocked' };
  }
  return { ok: true };
}

function checkLength(text) {
  if (text.length < MIN_MSG_LENGTH || text.length > MAX_MSG_LENGTH) {
    return { ok: false, reason: `Message must be ${MIN_MSG_LENGTH}-${MAX_MSG_LENGTH} chars` };
  }
  return { ok: true };
}

let messageId = 0;

// --- Connection limit per IP ---
io.use((socket, next) => {
  const ip = getIP(socket);
  const count = ipConnections.get(ip) || 0;
  if (count >= MAX_CONNECTIONS_PER_IP) {
    return next(new Error('Too many connections from your IP'));
  }
  ipConnections.set(ip, count + 1);
  socket.ip = ip;
  next();
});

io.on('connection', (socket) => {
  console.log(`Socket connected: ${socket.id} (IP: ${socket.ip})`);

  socket.on('join', (name) => {
    const isMod = moderatorId === null;
    if (isMod) moderatorId = socket.id;

    users.set(socket.id, {
      name,
      joinedAt: Date.now(),
      ip: socket.ip,
      isMod,
      lastMsg: 0,
      lastMsgText: '',
      msgTimestamps: [],
    });

    const badge = isMod ? ' [MOD]' : '';
    io.emit('message', { type: 'system', text: `${name}${badge} joined the chat` });
    io.emit('users', getUsersList());
  });

  socket.on('message', (text) => {
    const user = users.get(socket.id);
    if (!user) return;
    if (typeof text !== 'string') return;

    text = text.trim();

    // Run all checks
    for (const check of [checkLength(text), checkRateLimit(user), checkSlowMode(user), checkDuplicate(user, text)]) {
      if (!check.ok) {
        socket.emit('error-message', check.reason);
        return;
      }
    }

    // Track for rate limiting
    user.msgTimestamps.push(Date.now());
    user.lastMsg = Date.now();
    user.lastMsgText = text;

    io.emit('message', {
      id: ++messageId,
      name: user.name,
      text,
      timestamp: Date.now(),
      isMod: user.isMod,
    });
  });

  socket.on('typing', () => {
    const user = users.get(socket.id);
    if (!user) return;
    socket.broadcast.emit('typing', { name: user.name });
  });

  socket.on('disconnect', () => {
    const user = users.get(socket.id);
    if (user) {
      // Decrement IP connections
      const count = ipConnections.get(user.ip) || 1;
      if (count <= 1) ipConnections.delete(user.ip);
      else ipConnections.set(user.ip, count - 1);

      // Transfer moderator if mod leaves
      if (socket.id === moderatorId) {
        moderatorId = null;
        const remaining = Array.from(users.keys()).filter((id) => id !== socket.id);
        if (remaining.length > 0) {
          moderatorId = remaining[0];
          const newMod = users.get(moderatorId);
          newMod.isMod = true;
          io.emit('message', { type: 'system', text: `${newMod.name} is now the moderator` });
        }
      }

      users.delete(socket.id);
      io.emit('message', { type: 'system', text: `${user.name} left the chat` });
      io.emit('users', getUsersList());
    }
    console.log(`Socket disconnected: ${socket.id}`);
  });
});

server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
