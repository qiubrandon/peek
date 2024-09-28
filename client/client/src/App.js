import React, { useState, useRef, useEffect } from 'react';
import io from 'socket.io-client';

const url = process.env.REACT_APP_TUNNEL_URL || "http://localhost:8080";
const socket = io.connect(url); // Connect to the server

function App() {
    const [peerConnection, setPeerConnection] = useState(null);
    const [remoteStream, setRemoteStream] = useState(null)
    const [localStream, setScreenStream] = useState(null)
    const [roomID, setRoomID] = useState(null);
    const localRef = useRef(null);
    const remoteRef = useRef(null);
    const roomInput = useRef(null);
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

        //const rS = event.streams[0];
        if (remoteRef.current){
         // console.log("Remote reference is not null")
          //console.log("Media Stream", event.streams[0])
          remoteRef.current.srcObject = event.streams[0]
        }
        
      setRemoteStream(event.streams[0])
      }
      pc.oniceconnectionstatechange = () => {
        console.log("ICE Connection State:", pc.iceConnectionState);
        if (pc.iceConnectionState === 'disconnected' || pc.iceConnectionState === 'failed' || pc.iceConnectionState === 'closed'){
          console.log("Peer has stopped sharing")
          if (remoteRef.current){
            remoteRef.current.srcObject = null;
          }
        }
    };
    
    pc.onsignalingstatechange = () => {
        console.log("Signaling State:", pc.signalingState);
    };
  
  //   pc.onnegotiationneeded = async () => { // dynamic re-negotiation
  //     try {
  //         const offer = await pc.createOffer();
  //         await pc.setLocalDescription(offer);
  //         socket.emit('offer', { sdp: offer.sdp, type: offer.type });
  //     } catch (error) {
  //         console.error("Error in renegotiation:", error);
  //     }
  // };

      setPeerConnection(pc);
      return () => {
        pc.close()
      }
    },[])


    useEffect(()=>{
      // handle on offer
      socket.on('offer', async ({sdp,type}) => {
        if (peerConnection.signalingState === 'stable' || peerConnection.signalingState === 'have-remote-offer'){
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
          console.warn("Cannot accept answer, signaling state isn't 'have-local-offer', instead is", peerConnection.signalingState)
        }
      })

      socket.on('ice-candidate', async (candidate)=>{
        console.log("ICE Candidate added to connection")
        if (peerConnection){
          await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
        }
      })

      socket.on('stream-stopped', ()=>{
        console.log("Peer has stopped streaming")
        if (remoteRef.current){
          remoteRef.current.srcObject = null;
        }
        if (remoteStream){
          setRemoteStream(null);
        }
      })

      socket.on('created-room', (roomID)=>{
        console.log("Generated ID",roomID)
      })

      return () => {
        socket.off('offer')
        socket.off('answer')
        socket.off('ice-candidate')
        socket.off('stream-stopped')
      }
    },[peerConnection])

    // useEffect(()=>{

    // },[roomID])
    
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

  // useEffect(()=>{
  //   // detecting stopped track, clear the video
  //   // console.log("Use effect is in effect")
  //   if (remoteStream){
  //     console.log("Remote stream exists")
  //    remoteStream.getTracks().forEach((track)=>{
  //     console.log("Attaching event handler")
  //     track.onended = () => {
  //       console.log("Other user has stopped streaming")
  //       if (remoteRef.current){
  //         remoteRef.current.srcObject = null;
  //       }
  //     }
  //   })
  // }
  // },[remoteStream])

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
    //console.log("waiting for ice")
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
            if (roomID == null){
              console.log("Set a room id")
              return;
            }
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
            socket.emit('offer', {sdp: offer.sdp, roomID: roomID,type: offer.type});
            await waitForIceConnection(peerConnection);

            // now it propagates through signaling server. 
            // testing with same machine on different browsers.
            setScreenStream(stream)
            console.log("ICE Connection is stable!")  
            
        } catch (err) {
            console.error('Error capturing screen: ', err);
        }
    };

    const stopCapture = () => {
      if (localStream) {
        localStream.getTracks().forEach((track)=>{
          track.stop()
        })
      }
      else {
        console.log("Stream is not active.")
        return;
      }
      const senders = peerConnection.getSenders();
      senders.forEach(sender => {
          if (sender.track) {
              sender.track.stop();
              peerConnection.removeTrack(sender);
          }
      });
      if (localRef.current) {
        localRef.current.srcObject = null;
      }
      socket.emit('stream-stopped', {roomID: roomID})
      setScreenStream(null); // reset state
      console.log("Stopping share!")
    }

    const joinRoom = () => {
      if (roomInput.current){
        setRoomID(roomInput.current.value)
        console.log("Setting value to", roomInput.current.value)
      }
    }

    const createRoom = () => {
      socket.emit('create-room');
    }

    return (
      <div>
          <h1>Peek: Screen-sharing made simple!</h1>
          <button onClick={startScreenCapture}>Start Screen Share</button>
          <button onClick={stopCapture}>Stop Screen Share</button>
          <input ref={roomInput}></input>
          <button onClick={joinRoom}>Join Room</button>
          <button onClick={createRoom}>Create Room</button>
          <h2>Your Screen</h2>
          <video ref={localRef} autoPlay muted style={{ width: '80%' }} />

          <h2>Remote Screen</h2>  
          <video ref={remoteRef} autoPlay muted style={{ width: '80%' }}  />
      </div>
  );
}

export default App;
