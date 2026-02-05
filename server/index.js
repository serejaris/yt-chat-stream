import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 3000;
const isProd = process.env.NODE_ENV === 'production';

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

const users = new Map();

function getUserNames() {
  return Array.from(users.values()).map((u) => u.name);
}

let messageId = 0;

io.on('connection', (socket) => {
  console.log(`Socket connected: ${socket.id}`);

  socket.on('join', (name) => {
    users.set(socket.id, { name, joinedAt: Date.now() });
    io.emit('message', { type: 'system', text: `${name} joined the chat` });
    io.emit('users', getUserNames());
  });

  socket.on('message', (text) => {
    const user = users.get(socket.id);
    if (!user) return;

    io.emit('message', {
      id: ++messageId,
      name: user.name,
      text,
      timestamp: Date.now(),
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
      users.delete(socket.id);
      io.emit('message', { type: 'system', text: `${user.name} left the chat` });
      io.emit('users', getUserNames());
    }
    console.log(`Socket disconnected: ${socket.id}`);
  });
});

server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
