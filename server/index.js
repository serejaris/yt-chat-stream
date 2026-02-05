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
}

const server = createServer(app);

const io = new Server(server, {
  cors: isProd
    ? undefined
    : { origin: 'http://localhost:5173', methods: ['GET', 'POST'] },
});

const users = new Map();

function getUsersList() {
  return Array.from(users.values());
}

let messageId = 0;

io.on('connection', (socket) => {
  console.log(`Socket connected: ${socket.id}`);

  socket.on('join', ({ name }) => {
    users.set(socket.id, { name, joinedAt: Date.now() });
    socket.broadcast.emit('user-joined', { name });
    io.emit('users-list', getUsersList());
  });

  socket.on('chat-message', ({ text }) => {
    const user = users.get(socket.id);
    if (!user) return;

    io.emit('chat-message', {
      id: ++messageId,
      name: user.name,
      text,
      timestamp: Date.now(),
    });
  });

  socket.on('typing', () => {
    const user = users.get(socket.id);
    if (!user) return;
    socket.broadcast.emit('user-typing', { name: user.name });
  });

  socket.on('stop-typing', () => {
    const user = users.get(socket.id);
    if (!user) return;
    socket.broadcast.emit('user-stop-typing', { name: user.name });
  });

  socket.on('disconnect', () => {
    const user = users.get(socket.id);
    if (user) {
      users.delete(socket.id);
      io.emit('user-left', { name: user.name });
      io.emit('users-list', getUsersList());
    }
    console.log(`Socket disconnected: ${socket.id}`);
  });
});

server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
