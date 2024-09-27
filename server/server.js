const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const cors = require('cors')

const app = express();
const server = http.createServer(app);
// FOR DEVELOPMENT PURPOSES ONLY
const io = socketIo(server, {
    cors: {
        origin: "http://localhost:3000", // Allow requests from this origin
        methods: ["GET", "POST"],
        allowedHeaders: ["my-custom-header"],
        credentials: true
    }
});

app.use(cors())

// Serve React static files
if (process.env.NODE_ENV === 'production') {
    app.use(express.static(path.join(__dirname, '../client/client/build')));

    app.get('*', (req, res) => {
        res.sendFile(path.join(__dirname, '../client/client/build', 'index.html'));
    });
}

// WebSocket connections
io.on('connection', (socket) => {
    console.log('A user connected');
    
    socket.on('offer', ({sdp, type})=>{
        socket.broadcast.emit('offer', {sdp,type});
    })

    socket.on('answer', ({sdp,type})=>{
        socket.broadcast.emit('answer',{sdp,type})
    })

    socket.on('disconnect', () => {
        console.log('User disconnected');
    });

    socket.on('ice-candidate', (candidate)=>{
        socket.broadcast.emit('ice-candidate', candidate)
    })

    socket.on('screen-share', (data) => {
        socket.broadcast.emit('screen-share', data); // EMITS TO ALL (EXCEPT SENDER)
    });
});

const PORT = process.env.PORT || 8080;
server.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
