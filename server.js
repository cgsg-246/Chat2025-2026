const http = require("http");
const express = require("express");
const logger = require("morgan");
const { Server } = require("socket.io");
const cookieParser = require("cookie-parser");
const crypto = require("crypto");
const fs = require("fs");

const app = express();
const PORT = process.env.PORT || 3000;

const RENDER_APP_NAME = 'my-super-chat'; 
const SELF_PING_URL = `https://${RENDER_APP_NAME}://`;

const FILE = './users.data';
const MESSAGES_FILE = './messages.data';

function myMiddleware(req, res, next) {
    console.log(`Request for ${req.url}`);
    next();
}

app.use(myMiddleware);
app.use(logger("dev"));
app.use(cookieParser());
app.use(express.static("dist"));

app.get('/ping', (req, res) => {
    res.send('pong');
});

app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).send("Something broke!");
});

const server = http.createServer(app);

const io = new Server(server, {
    path: "/socket.io",
    cors: { origin: "*" }
});

let users = {};
try { users = fs.existsSync(FILE) ? JSON.parse(fs.readFileSync(FILE, 'utf8')) : {}; } catch { users = {}; }

let messagesHistory = [];
try { messagesHistory = fs.existsSync(MESSAGES_FILE) ? JSON.parse(fs.readFileSync(MESSAGES_FILE, 'utf8')) : []; } catch { messagesHistory = []; }

const getHash = (pass) => crypto.createHash('sha256').update(pass).digest('hex');

io.on("connection", (socket) => {
    console.log("Connection opened via Socket.io");

    socket.on("login", (data) => {
        const { username, password } = data;

        if (users[username]) {
            if (users[username] === getHash(password)) {
                socket.emit('login_success', { username });
                socket.emit('chat_history', messagesHistory);
                io.emit('sys_notification', { text: `Пользователь ${username} вошел в чат` });
            } else {
                socket.emit('login_error', { message: 'Неверный пароль!' });
            }
        } else {
            socket.emit('user_not_found', { message: 'Пользователь не найден. Создать?', username });
        }
    });

    socket.on("register", (data) => {
        users[data.username] = getHash(data.password);
        try { fs.writeFileSync(FILE, JSON.stringify(users, null, 2)); } catch (e) { console.error(e); }
        socket.emit('login_success', { username: data.username });
        socket.emit('chat_history', messagesHistory);
        io.emit('sys_notification', { text: `Новый пользователь ${data.username} зарегистрировался и вошел в чат 🎉` });
    });

    socket.on("chat_message", (data) => {
        const msgObject = { type: 'user', user: data.user, text: data.text };
        messagesHistory.push(msgObject);
        if (messagesHistory.length > 100) messagesHistory.shift();
        try { fs.writeFileSync(MESSAGES_FILE, JSON.stringify(messagesHistory, null, 2)); } catch (e) { console.error(e); }

        io.emit('chat_message', data);
    });
});

setInterval(async () => {
    try {
        const response = await fetch(SELF_PING_URL);
        console.log(`[Self-Ping] Status: ${response.status}`);
    } catch (error) {
        console.error('[Self-Ping] Error:', error.message);
    }
}, 10 * 60 * 1000);

server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
