import React, { useState, useRef, useEffect } from 'react';
import io from 'socket.io-client';

const url = process.env.REACT_APP_EC2 || "http://localhost:8080";
console.log("URL", url)
const socket = io.connect(url); // Connect to the server
const ICE_SERVERS = JSON.parse(process.env.REACT_APP_ICESERVERS)
//const ICE_SERVERS = 

function App() {
    const [peerConnection, setPeerConnection] = useState(null);
    const [remoteStream, setRemoteStream] = useState(null)
    const [localStream, setScreenStream] = useState(null)
    const [roomID, setRoomID] = useState(null);
    const localRef = useRef(null);
    const remoteRef = useRef(null);
    const roomInput = useRef(null);
    const roomDisplay = useRef(null);
    const roomIDRef = useRef(roomID);
    const iceServers = {
      iceServers: ICE_SERVERS
    }

    // prevent weird errors with roomid state
    useEffect(() => {
      roomIDRef.current = roomID; // Update the ref whenever roomID changes
      roomDisplay.current.innerText = `Room: ${roomID}`
    }, [roomID]);


    // establish peer
    useEffect(()=>{
      const pc = new RTCPeerConnection(iceServers); // create peer
      // send out ice candidate from client
      pc.onicecandidate = (event) => {
        if (event.candidate) {
         // console.log("Received ICE candidate!")
          //console.log("ICE CANDIDATE ROOMID",roomIDRef.current)
          socket.emit('ice-candidate', {candidate: event.candidate, roomID: roomIDRef.current}); // send candidate to signaling server
        }
      }
      pc.ontrack = async (event) => {

        //const rS = event.streams[0];
        await waitForSignalingState(pc);
        if (remoteRef.current && pc.signalingState === 'stable'){
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
      socket.on('offer', async ({sdp,roomID,type}) => {
        if (peerConnection.signalingState === 'stable' || peerConnection.signalingState === 'have-remote-offer'){
          console.log("Receiving offer!")
          console.log("Offer id",roomID)
          await peerConnection.setRemoteDescription(new RTCSessionDescription({sdp,type}))
          const answer = await peerConnection.createAnswer();
          await peerConnection.setLocalDescription(answer)
          socket.emit('answer', {sdp:answer.sdp, roomID: roomID, type:answer.type})
        }
      })

      socket.on('answer', async ({sdp,roomID,type})=>{
        console.log("Received answer!")
        if (peerConnection.signalingState === 'have-local-offer'){
          await peerConnection.setRemoteDescription(new RTCSessionDescription({sdp,type}));
        } else {
          console.warn("Cannot accept answer, signaling state isn't 'have-local-offer', instead is", peerConnection.signalingState)
        }
      })

      socket.on('ice-candidate', async (candidate)=>{
    //    console.log("ICE Candidate added to connection")
        if (peerConnection){
          await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
          console.log("New IceCandidate added")
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

      socket.on('room-created', (roomID)=>{
        setRoomID(roomID)
        // roomInput.current.value = roomID
        console.log("Created and join room",roomID)
      })

      socket.on('join-confirmation', ({status, connected, id})=>{
        console.log(`Status: ${status}\n Connected: ${connected} on ${id}`)
        setRoomID(id)
      })

      return () => {
        socket.off('offer')
        socket.off('answer')
        socket.off('ice-candidate')
        socket.off('stream-stopped')
        socket.off('room-created')
        socket.off('join-confirmation')
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
            console.log("Screen capture id", roomID)
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
        const input = roomInput.current.value;
        if (input && input.length == 7){
          socket.emit('join-room', input)
        } else {
          console.log("Invalid input!")
        }
        //console.log("Setting value to", roomInput.current.value)
      }
    }

    const createRoom = () => {
      socket.emit('create-room');
    }

    return (
      <div>
          <h1>Peek: Screen-sharing made simple!</h1>
          <p ref={roomDisplay}>Currently not in a room.</p>
          <button onClick={startScreenCapture}>Start Screen Share</button>
          <button onClick={stopCapture}>Stop Screen Share</button>
          <input ref={roomInput}></input>
          <button onClick={joinRoom}>Join Room</button>
          <button onClick={createRoom}>Create Room</button>
          <h2>Your Screen</h2>
          <video ref={localRef} autoPlay muted style={{ width: '80%' }} />

          <h2>Remote Screen</h2>  
          <video ref={remoteRef} autoPlay playsInline muted={true} style={{ width: '80%' }}  />
      </div>
  );
}

export default App;
