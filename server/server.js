const express = require('express');
const http = require('http');
const sckt = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app)
const io = sckt(server);

app.use(express.static(path.join(__dirname, '../client')));

io.on('connection', (socket) => {
    console.log('A user connected');
    socket.on('disconnect', () => {
        console.log('User disconnected');
    });

    // webrtc connections handler
    socket.on('signal', (data) => {
        socket.broadcast.emit('signal', data);
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});