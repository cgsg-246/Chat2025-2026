import { io } from 'socket.io-client';

const socket = io(`http://${location.host}`);

let currentUser = "";
let tempCredentials = null;

const el = (id) => document.getElementById(id);

el('login-btn').addEventListener('click', () => {
    const username = el('username').value.trim();
    const password = el('password').value;
    if (!username || !password) return;

    el('error-msg').textContent = "";
    el('reg-btn').style.display = "none";

    tempCredentials = { username, password };

    socket.emit('login', { username, password });
});

el('reg-btn').addEventListener('click', () => {
    if (tempCredentials) {
        socket.emit('register', {
            username: tempCredentials.username,
            password: tempCredentials.password
        });
    }
});

el('send-btn').addEventListener('click', sendMessage);
el('msg-input').addEventListener('keypress', (e) => e.key === 'Enter' && sendMessage());

function sendMessage() {
    const input = el('msg-input');
    if (!input.value.trim()) return;

    socket.emit('chat_message', { user: currentUser, text: input.value });
    input.value = "";
}

function appendUserMessage(user, text) {
    const msgDiv = document.createElement('div');
    const nameSpan = document.createElement('b');
    nameSpan.textContent = `${user}: `;
    const textSpan = document.createElement('span');
    textSpan.textContent = text;
    msgDiv.appendChild(nameSpan);
    msgDiv.appendChild(textSpan);
    el('messages').appendChild(msgDiv);
}

socket.on('login_success', (data) => {
    currentUser = data.username;
    el('auth-block').style.display = 'none';
    el('chat-block').style.display = 'block';
});

socket.on('login_error', (data) => {
    el('error-msg').textContent = data.message;
    el('auth-block').style.display = 'block';
    el('chat-block').style.display = 'none';
});

socket.on('user_not_found', (data) => {
    el('error-msg').textContent = data.message;
    el('reg-btn').style.display = "block";
});

socket.on('chat_history', (history) => {
    el('messages').innerHTML = "";
    history.forEach(msg => {
        if (msg.type === 'user') {
            appendUserMessage(msg.user, msg.text);
        }
    });
    el('messages').scrollTop = el('messages').scrollHeight;
});

socket.on('chat_message', (data) => {
    appendUserMessage(data.user, data.text);
    el('messages').scrollTop = el('messages').scrollHeight;
});

socket.on('sys_notification', (data) => {
    const msgDiv = document.createElement('div');
    msgDiv.style.textAlign = 'center';
    msgDiv.style.color = '#a87687';
    msgDiv.style.fontStyle = 'italic';
    msgDiv.style.opacity = '0.7';
    msgDiv.style.fontSize = '13px';
    msgDiv.style.margin = '10px 0';
    msgDiv.textContent = data.text;
    el('messages').appendChild(msgDiv);
    el('messages').scrollTop = el('messages').scrollHeight;
});
