const express = require("express");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const cors = require("cors");

const app = express();

const PORT = process.env.PORT || 8080;

const FILE = path.join(__dirname, 'users.data');
const MESSAGES_FILE = path.join(__dirname, 'messages.data');

app.use(cors());

app.use(express.json());

let users = {};
try { users = fs.existsSync(FILE) ? JSON.parse(fs.readFileSync(FILE, 'utf8')) : {}; } catch { users = {}; }

let messagesHistory = [];
try { messagesHistory = fs.existsSync(MESSAGES_FILE) ? JSON.parse(fs.readFileSync(MESSAGES_FILE, 'utf8')) : []; } catch { messagesHistory = []; }

const getHash = (pass) => crypto.createHash('sha256').update(pass).digest('hex');

app.get('/ping', (req, res) => res.send('pong'));

app.post('/api/login', (req, res) => {
    try {
        const { username, password } = req.body;
        if (!users[username]) {
            return res.status(404).json({ message: 'Пользователь не найден. Создать?' });
        }
        if (users[username] === getHash(password)) {
            return res.status(200).json({ username });
        }
        return res.status(401).json({ message: 'Неверный пароль!' });
    } catch (error) {
        console.error("Ошибка в /api/login:", error);
        res.status(500).json({ message: "Ошибка сервера" });
    }
});

app.post('/api/register', (req, res) => {
    const { username, password } = req.body;
    users[username] = getHash(password);
    try { fs.writeFileSync(FILE, JSON.stringify(users, null, 2)); } catch (e) { console.error(e); }
    res.status(201).json({ username });
});

app.get('/api/messages', (req, res) => {
    res.json(messagesHistory);
});

app.post('/api/message', (req, res) => {
    const { user, text } = req.body;
    const msgObject = { user, text };
    messagesHistory.push(msgObject);
    if (messagesHistory.length > 100) messagesHistory.shift(); // Храним только последние 100 сообщений
    try { fs.writeFileSync(MESSAGES_FILE, JSON.stringify(messagesHistory, null, 2)); } catch (e) { console.error(e); }
    res.status(201).json(msgObject);
});

app.use(express.static(path.join(__dirname, 'dist')));

app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
