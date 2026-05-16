const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: { origin: "*" }
});

app.use(express.static(path.join(__dirname, 'public')));

let players = {};
let enemies = [];
let leaderboard = [];
let enemyIdCounter = 0;

const WIDTH = 400;
const HEIGHT = 600;

io.on('connection', (socket) => {
    console.log(`Jugador conectado: ${socket.id}`);

    socket.on('joinGame', (username) => {
        players[socket.id] = {
            id: socket.id,
            name: username.substring(0, 12) || 'Anónimo',
            x: WIDTH / 2 - 20,
            y: HEIGHT - 100,
            width: 40,
            height: 40,
            score: 0,
            color: `hsl(${Math.random() * 360}, 80%, 55%)`,
            active: true
        };
        socket.emit('init', { id: socket.id, leaderboard });
    });

    socket.on('updateInput', (input) => {
        const p = players[socket.id];
        if (!p || !p.active) return;
        let speed = input.speed || 7;
        if (input.left && p.x > 0) p.x -= speed;
        if (input.right && p.x < WIDTH - p.width) p.x += speed;
        if (input.up && p.y > 0) p.y -= speed;
        if (input.down && p.y < HEIGHT - p.height) p.y += speed;
    });

    socket.on('enemyHit', (enemyId) => {
        const p = players[socket.id];
        if (!p || !p.active) return;
        const enemyIndex = enemies.findIndex(e => e.id === enemyId);
        if (enemyIndex !== -1) {
            io.emit('spawnExplosion', { x: enemies[enemyIndex].x, y: enemies[enemyIndex].y, color: enemies[enemyIndex].color });
            enemies.splice(enemyIndex, 1);
            p.score += 2;
            updateLeaderboard();
        }
    });

    socket.on('playerKilled', () => {
        const p = players[socket.id];
        if (p && p.active) {
            p.active = false;
            io.emit('spawnExplosion', { x: p.x + 20, y: p.y + 20, color: '#ff0055' });
            updateLeaderboard();
        }
    });

    socket.on('respawn', () => {
        const p = players[socket.id];
        if (p && !p.active) {
            p.x = WIDTH / 2 - 20;
            p.y = HEIGHT - 100;
            p.score = 0;
            p.active = true;
            updateLeaderboard();
        }
    });

    socket.on('disconnect', () => {
        delete players[socket.id];
        updateLeaderboard();
        console.log(`Jugador desconectado: ${socket.id}`);
    });
});

function updateLeaderboard() {
    leaderboard = Object.values(players)
        .map(p => ({ name: p.name, score: p.score }))
        .sort((a, b) => b.score - a.score)
        .slice(0, 5);
    io.emit('updateLeaderboard', leaderboard);
}

function serverLoop() {
    if (Math.random() < 0.03 && enemies.length < 10) {
        const size = Math.random() * 25 + 20;
        enemies.push({
            id: enemyIdCounter++,
            x: Math.random() * (WIDTH - size),
            y: -size,
            width: size,
            height: size,
            speed: Math.random() * 1.5 + 2.5,
            color: `hsl(${Math.random() * 35}, 80%, 55%)`
        });
    }

    for (let i = enemies.length - 1; i >= 0; i--) {
        enemies[i].y += enemies[i].speed;
        if (enemies[i].y > HEIGHT) {
            enemies.splice(i, 1);
        }
    }

    io.emit('gameState', { players, enemies });
}

setInterval(serverLoop, 1000 / 60);

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Servidor corriendo en el puerto ${PORT}`));
