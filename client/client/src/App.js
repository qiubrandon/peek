import React, { useState, useRef } from 'react';
import io from 'socket.io-client';

const socket = io.connect('http://localhost:3000'); // Connect to the server

function App() {
    const [screenStream, setScreenStream] = useState(null);
    const videoRef = useRef(null);

    const startScreenCapture = async () => {
        try {
            const stream = await navigator.mediaDevices.getDisplayMedia({
                video: true
            });
            setScreenStream(stream);
            if (videoRef.current) {
                videoRef.current.srcObject = stream;
            }

            // Emit the screen stream through socket.io for signaling (expand this to send to peers)
            socket.emit('screen-share', { streamId: stream.id });

        } catch (err) {
            console.error('Error capturing screen: ', err);
        }
    };

    return (
        <div className="App">
            <h1>React Screen Sharing App</h1>
            <button onClick={startScreenCapture}>Start Screen Share</button>
            <div>
                <video ref={videoRef} autoPlay style={{ width: '80%', marginTop: '20px' }}></video>
            </div>
        </div>
    );
}

export default App;
