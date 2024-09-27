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
         // console.log("Remote reference is not null")
          //console.log("Media Stream", event.streams[0])
          remoteRef.current.srcObject = event.streams[0]
        }

        // detecting stopped track, clear the video
        if (remoteStream){
        remoteStream.getTracks().forEach((track)=>{
          track.onended = () => {
            console.log("Other user has stopped streaming")
            if (remoteRef.current){
              remoteRef.current.srcObject = null;
            }
          }
        })
      }

      }
      pc.oniceconnectionstatechange = () => {
        console.log("ICE Connection State:", pc.iceConnectionState);
    };
    
    pc.onsignalingstatechange = () => {
        console.log("Signaling State:", pc.signalingState);
    };
  
      setPeerConnection(pc);
      return () => {
        pc.close()
      }
    },[])

    useEffect(()=>{
      // handle on offer
      socket.on('offer', async ({sdp,type}) => {
        if (peerConnection.signalingState === 'stable'){
          console.log("Receiving offer!")
          await peerConnection.setRemoteDescription(new RTCSessionDescription({sdp,type}))
          const answer = await peerConnection.createAnswer();
          await peerConnection.setLocalDescription(answer)
          socket.emit('answer', {sdp:answer.sdp, type:answer.type})
        }
      })

      socket.on('answer', async ({sdp,type})=>{
        console.log("Received answer!")
        if (peerConnection.signalingState === 'have-local-offer'){
          await peerConnection.setRemoteDescription(new RTCSessionDescription({sdp,type}));
        } else {
          console.warn("Cannot accept answer, signaling state isn't 'have-local-offer'")
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
    
    // for existing rtc connection
  //   const shareMedia = async () => {
  //     const stream = await navigator.mediaDevices.getDisplayMedia({ video: true });
  
  //     const senders = peerConnection.getSenders();
  //     stream.getTracks().forEach(track => {
  //         const existingSender = senders.find(sender => sender.track && sender.track.kind === track.kind);
  //         if (!existingSender) {
  //             peerConnection.addTrack(track, stream); // Add new track if it's not already added
  //         }
  //     });
  //     peerConnection.onnegotiationneeded = async () => {
  //         const offer = await peerConnection.createOffer();
  //         await peerConnection.setLocalDescription(offer);
  //         socket.emit('offer', { sdp: offer.sdp, type: offer.type });
  //         console.log("Renegotiating offer!");
  //     };
  // };

  const waitForSignalingState = (peerConnection) => {
    console.log("Waiting for signaling state to stabilize...");
    return new Promise((resolve, reject) => {
        if (peerConnection.signalingState === 'stable') {
            console.log("Signaling state is already stable.");
            resolve();
        } else {
            peerConnection.onsignalingstatechange = () => {
                console.log("Signaling state changed:", peerConnection.signalingState);
                if (peerConnection.signalingState === 'stable') {
                    console.log("Signaling state is now stable, resolving...");
                    resolve();
                }
            };
        }
    });
};
  // add media track only after promise is resolved / preventing inconsistencies
  const waitForIceConnection = (peerConnection) => {
    console.log("waiting for ice")
    return new Promise((resolve, reject) => {
        if (peerConnection.iceConnectionState === 'connected' || peerConnection.iceConnectionState === 'completed') {
            console.log("ICE connection already stable.");
            resolve();
        } else {
            peerConnection.oniceconnectionstatechange = () => {
                if (peerConnection.iceConnectionState === 'connected' || peerConnection.iceConnectionState === 'completed') {
                    console.log("ICE connection stable, resolving...");
                    resolve();
                } else if (peerConnection.iceConnectionState === 'failed') {
                    reject(new Error("ICE connection failed."));
                }
            };
        }
    });
};

    // function to start screen capture
    const startScreenCapture = async () => {
        try {
            const stream = await navigator.mediaDevices.getDisplayMedia({
                video: true
            });
            if (localRef.current){
              localRef.current.srcObject = stream;
            }

            await waitForSignalingState(peerConnection);

            console.log("Adding Tracks!")
            stream.getTracks().forEach(track => peerConnection.addTrack(track, stream))
            const offer = await peerConnection.createOffer(); // yes.
            await peerConnection.setLocalDescription(offer);
            socket.emit('offer', {sdp: offer.sdp, type: offer.type});
            await waitForIceConnection(peerConnection);

            // now it propagates through signaling server. 
            // testing with same machine on different browsers.
            console.log("ICE Connection is stable!")  
            
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
          <video ref={remoteRef} autoPlay muted style={{ width: '80%' }}  />
      </div>
  );
}

export default App;
