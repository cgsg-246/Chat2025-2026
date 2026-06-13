const API_URL = window.location.origin;

let currentUser = localStorage.getItem("username") || "";
let token = localStorage.getItem("token") || "";
let tempCredentials = null;
let pollingTimer = null;

const el = (id) => document.getElementById(id);

if (token && currentUser) {
    if (el('auth-block')) el('auth-block').style.display = 'none';
    if (el('chat-block')) el('chat-block').style.display = 'block';
    startChatPolling();
}

if (el('login-btn')) {
    el('login-btn').addEventListener('click', async () => {
        const username = el('username').value.trim();
        const password = el('password').value;
        if (!username || !password) return;

        el('error-msg').textContent = "Вход...";
        el('reg-btn').style.display = "none";
        tempCredentials = { username, password };

        try {
            const res = await fetch(`${API_URL}/api/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password })
            });
            const data = await res.json();

            if (res.status === 200) {
                currentUser = data.username;
                token = data.token;
                localStorage.setItem("username", currentUser);
                localStorage.setItem("token", token);

                el('auth-block').style.display = 'none';
                el('chat-block').style.display = 'block';
                startChatPolling();
            } else if (res.status === 404) {
                el('error-msg').textContent = data.message;
                el('reg-btn').style.display = "block";
            } else {
                el('error-msg').textContent = data.message;
            }
        } catch (err) {
            el('error-msg').textContent = "Сервер просыпается, подождите 1 минуту...";
        }
    });
}

if (el('reg-btn')) {
    el('reg-btn').addEventListener('click', async () => {
        if (!tempCredentials) return;
        try {
            const res = await fetch(`${API_URL}/api/register`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(tempCredentials)
            });
            const data = await res.json();

            if (res.ok) {
                el('error-msg').textContent = "Успешно! Нажмите 'Войти'.";
                el('reg-btn').style.display = "none";
            } else {
                el('error-msg').textContent = data.message || "Ошибка регистрации";
            }
        } catch (err) {
            el('error-msg').textContent = "Ошибка регистрации.";
        }
    });
}

if (el('send-btn')) el('send-btn').addEventListener('click', sendMessage);
if (el('msg-input')) el('msg-input').addEventListener('keypress', (e) => e.key === 'Enter' && sendMessage());

async function sendMessage() {
    const input = el('msg-input');
    const text = input.value.trim();
    if (!text) return;
    input.value = "";

    try {
        const res = await fetch(`${API_URL}/api/message`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ text })
        });

        if (res.status === 401 || res.status === 403) {
            alert("Сессия истекла. Войдите заново.");
            localStorage.clear();
            location.reload();
            return;
        }

        await loadMessages();
    } catch (err) {
        console.error("Не удалось отправить сообщение");
    }
}

async function loadMessages() {
    try {
        const res = await fetch(`${API_URL}/api/messages`);
        const history = await res.json();
        const messagesDiv = el('messages');

        if (!messagesDiv) return;

        const isAtBottom = messagesDiv.clientHeight === 0 ||
            (messagesDiv.scrollHeight - messagesDiv.clientHeight <= messagesDiv.scrollTop + 50);

        messagesDiv.innerHTML = "";
        history.forEach(msg => {
            const msgDiv = document.createElement('div');
            const nameSpan = document.createElement('b');
            nameSpan.textContent = `${msg.user}: `;
            const textSpan = document.createElement('span');
            textSpan.textContent = msg.text;
            msgDiv.appendChild(nameSpan);
            msgDiv.appendChild(textSpan);
            messagesDiv.appendChild(msgDiv);
        });

        if (isAtBottom && messagesDiv.clientHeight > 0) {
            messagesDiv.scrollTop = messagesDiv.scrollHeight;
        }
    } catch (err) {
        console.error("Ошибка обновления чата", err);
    }
}

async function startChatPolling() {
    if (pollingTimer) clearTimeout(pollingTimer);
    await loadMessages();

    async function poll() {
        await loadMessages();
        pollingTimer = setTimeout(poll, 3000);
    }
    pollingTimer = setTimeout(poll, 3000);
}
