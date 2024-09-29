const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const cors = require('cors')
require('dotenv').config();  // Load environment variables

// const {nanoid} = require('nanoid');

const app = express();
const server = http.createServer(app);

// FOR DEVELOPMENT PURPOSES ONLY
//const url = process.env.TUNNEL_URL
const idAPI = process.env.API_URL
const allowedOrigins = process.env.NODE_ENV === 'production' ? 
    [url] : 
    ["http://localhost:3000"];

const io = socketIo(server, {
    cors: {
        origin: allowedOrigins, // Allow requests from this origin
        methods: ["GET", "POST"],
        allowedHeaders: ["my-custom-header"],
        credentials: true
    }
});

async function genID() {
    // const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    // let id = '';
    // for (let i = 0; i < size; i++) {
    //   id += alphabet.charAt(Math.floor(Math.random() * alphabet.length));
    // }
    // return id;
    const a = ["/random/noun", "/random/adjective","/random/animal"]
    const selection = Math.floor((Math.random() * 3))
    return await fetch(`${idAPI}${a[selection]}`)
}

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
    
    socket.on('offer', (data)=>{ // data = {sdp: answer.sdp, type, roomID}
        console.log("Offer sent on room",data.roomID)
        socket.to(data.roomID).emit('offer', data);
    })

    socket.on('answer', (data)=>{
        socket.to(data.roomID).emit('answer',data)
    })

    socket.on('disconnect', () => {
        console.log('User disconnected');
    });

    socket.on('ice-candidate', (data)=>{
        console.log("Ice candidate")
        socket.to(data.roomID).emit('ice-candidate', data.candidate)
    })

    socket.on('stream-stopped', (data)=>{
        console.log("Stream stopped on room",data.roomID)
        socket.to(data.roomID).emit('stream-stopped')
    })

    socket.on('join-room', (roomID)=>{
        const rooms = Object.keys(socket.rooms);

        // Leave all rooms except the socket's own room (the default)
        rooms.forEach((room) => {
            if (room !== socket.id) {
                socket.leave(room);
                console.log(`User left room: ${room}`);
            }
        });

        const room = io.of("/").adapter.rooms.get(roomID)
        console.log("A user is attempting to join room",roomID)
        if (room){ // room exists
            socket.join(roomID)
            socket.emit('join-confirmation', {status: "ok", connected: null, id: roomID})
            console.log(`User joined room: ${roomID}`)
        }
        else{
            console.log(`Room ${roomID} does not exist.`)
            socket.emit('join-confirmation', {status: "failed", connected: null, id: roomID})
        }
        // console.log("2. All rooms:", io.of("/").adapter.rooms)

    })

    socket.on('create-room', async ()=>{
        let roomID = await genID()
        socket.join(roomID)
        socket.emit('room-created',roomID)
    })

    socket.on('display', ()=>{
        const rooms = io.of("/").adapter.rooms
        console.log(rooms)
    })

    // socket.on('screen-share', (data) => {
    //     socket.broadcast.emit('screen-share', data); // EMITS TO ALL (EXCEPT SENDER)
    // });
});

const PORT = process.env.PORT || 8080;
server.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
