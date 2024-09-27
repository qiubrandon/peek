import React, { useState, useRef, useEffect } from 'react';
import io from 'socket.io-client';

const socket = io.connect('http://localhost:8080'); // Connect to the server

function App() {
    const [peerConnection, setPeerConnection] = useState(null);
    const [remoteStream, setRemoteStream] = useState(null)
    const [stream, setScreenStream] = useState(null)
    const localRef = useRef(null);
    const remoteRef = useRef(null);
    const iceServers = {
      iceServers: [{
        urls: 'stun:stun.l.google.com:19302'
      }]
    }

    // establish peer
    useEffect(()=>{
      const pc = new RTCPeerConnection(iceServers); // create peer
      // send out ice candidate from client
      pc.onicecandidate = (event) => {
        if (event.candidate) {
          socket.emit('ice-candidate', event.candidate); // send candidate to signaling server
        }
      }
      pc.ontrack = (event) => {
        console.log("Setting stream!")
        if (remoteRef.current){
          console.log("Remote reference is not null")
          remoteRef.current.srcObject = event.streams[0]
        }
      }
      setPeerConnection(pc);
      return () => {
        pc.close()
      }
    },[])

    useEffect(()=>{
      // handle on offer
      socket.on('offer', async ({sdp,type}) => {
        if (peerConnection){
          console.log("Receiving offer!")
          await peerConnection.setRemoteDescription(new RTCSessionDescription({sdp,type}))
          const answer = await peerConnection.createAnswer();
          await peerConnection.setLocalDescription(answer)
          socket.emit('answer', {sdp:answer.sdp, type:answer.type})
        }
      })

      socket.on('answer', async ({sdp,type})=>{
        console.log("Received answer!")
        if (peerConnection){
          await peerConnection.setRemoteDescription(new RTCSessionDescription({sdp,type}));
        }
      })

      socket.on('ice-candidate', async (candidate)=>{
        console.log("ICE Candidate added to connection")
        if (peerConnection){
          await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
        }
      })

      return () => {
        socket.off('offer')
        socket.off('answer')
        socket.off('ice-candidate')
      }
    },[peerConnection])

    // function to start screen capture
    const startScreenCapture = async () => {
        try {
            const stream = await navigator.mediaDevices.getDisplayMedia({
                video: true
            });
            if (localRef.current){
              localRef.current.srcObject = stream;
            }
            stream.getTracks().forEach(track => peerConnection.addTrack(track, stream))
            const offer = await peerConnection.createOffer(); // yes.
            await peerConnection.setLocalDescription(offer);
            socket.emit('offer', {sdp: offer.sdp, type: offer.type});
            // now it propagates through signaling server. 
            // testing with same machine on different browsers.
            console.log("Creating offer!")

        } catch (err) {
            console.error('Error capturing screen: ', err);
        }
    };

    return (
      <div>
          <h1>Peek: Screen-sharing made simple!</h1>
          <button onClick={startScreenCapture}>Start Screen Share</button>

          <h2>Your Screen</h2>
          <video ref={localRef} autoPlay style={{ width: '80%' }} />

          <h2>Remote Screen</h2>
          <video ref={remoteRef} autoPlay style={{ width: '80%' }}  />
      </div>
  );
}

export default App;
