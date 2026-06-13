const express = require("express");
const path = require("path");
const cors = require("cors");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const { open } = require("sqlite");
const sqlite3 = require("sqlite3");

const app = express();
const PORT = process.env.PORT || 8080;
const JWT_SECRET = process.env.JWT_SECRET || "super-secret-key-change-me";

const dbPath = path.join(__dirname, 'database.db');
let db;

(async () => {
    try {
        db = await open({
            filename: dbPath,
            driver: sqlite3.Database
        });

        await db.exec(`
            CREATE TABLE IF NOT EXISTS users (
                username TEXT PRIMARY KEY,
                password TEXT NOT NULL
            );
            CREATE TABLE IF NOT EXISTS messages (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user TEXT NOT NULL,
                text TEXT NOT NULL,
                timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
            );
        `);
        console.log("База данных SQLite успешно подключена.");
    } catch (error) {
        console.error("Ошибка инициализации базы данных:", error);
    }
})();

app.use(cors());
app.use(express.json());

const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Корректно забираем сам токен после Bearer

    if (!token) return res.status(401).json({ message: "Доступ запрещен. Нужен токен." });

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) return res.status(403).json({ message: "Недействительный токен." });
        req.user = user;
        next();
    });
};

app.get('/ping', (req, res) => res.send('pong'));

app.post('/api/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        if (!username || !password) {
            return res.status(400).json({ message: "Заполните все поля" });
        }

        const user = await db.get("SELECT * FROM users WHERE username = ?", [username.trim()]);
        if (!user) {
            return res.status(404).json({ message: 'Пользователь не найден. Создать?' });
        }

        const validPassword = await bcrypt.compare(password, user.password);
        if (!validPassword) {
            return res.status(401).json({ message: 'Неверный пароль!' });
        }

        const token = jwt.sign({ username: user.username }, JWT_SECRET, { expiresIn: '24h' });
        return res.status(200).json({ username: user.username, token });
    } catch (error) {
        console.error("Ошибка в /api/login:", error);
        res.status(500).json({ message: "Ошибка сервера" });
    }
});

app.post('/api/register', async (req, res) => {
    try {
        const { username, password } = req.body;
        if (!username || !password) {
            return res.status(400).json({ message: "Заполните все поля" });
        }

        const trimmedUser = username.trim();
        const existingUser = await db.get("SELECT * FROM users WHERE username = ?", [trimmedUser]);
        if (existingUser) {
            return res.status(400).json({ message: "Пользователь уже существует" });
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        await db.run("INSERT INTO users (username, password) VALUES (?, ?)", [trimmedUser, hashedPassword]);

        res.status(201).json({ username: trimmedUser });
    } catch (e) {
        console.error("Ошибка регистрации:", e);
        res.status(500).json({ message: "Ошибка записи данных" });
    }
});

app.get('/api/messages', async (req, res) => {
    try {
        const history = await db.all("SELECT user, text FROM messages ORDER BY id DESC LIMIT 100");
        res.json(history.reverse());
    } catch (e) {
        res.status(500).json({ message: "Ошибка получения сообщений" });
    }
});

app.post('/api/message', authenticateToken, async (req, res) => {
    try {
        const { text } = req.body;
        if (!text || !text.trim()) return res.status(400).json({ message: "Текст пустой" });

        await db.run("INSERT INTO messages (user, text) VALUES (?, ?)", [req.user.username, text.trim()]);
        res.status(201).json({ user: req.user.username, text: text.trim() });
    } catch (e) {
        console.error("Ошибка сохранения сообщения:", e);
        res.status(500).json({ message: "Ошибка сохранения" });
    }
});

const distPath = path.join(__dirname, 'dist');
app.use(express.static(distPath));

app.get('/*', (req, res) => {
    const indexPath = path.join(distPath, 'index.html');
    try {
        require("fs").accessSync(indexPath);
        res.sendFile(indexPath);
    } catch {
        res.status(404).send('Бэкенд запущен, но собранный фронтенд (index.html) не найден в папке сборки!');
    }
});

app.listen(PORT, '0.0.0.0', () => console.log(`Server running on port ${PORT}`));
