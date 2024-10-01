import React, { useState, useRef, useEffect } from 'react';
import io from 'socket.io-client';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { Container, Button, TextField, Grid, Typography, Box, IconButton} from '@mui/material';
import FullscreenIcon from '@mui/icons-material/Fullscreen';


const url = process.env.REACT_APP_EC2 || "http://localhost:8080";
console.log("URL", url)
const socket = io.connect(url); // Connect to the server
const ICE_SERVERS = JSON.parse(process.env.REACT_APP_ICESERVERS)
//const ICE_SERVERS = 


function App() {
    const [peerConnection, setPeerConnection] = useState(null);
    const [remoteStream, setRemoteStream] = useState(null)
    const [localStream, setScreenStream] = useState(null)
    const [roomID, setRoomID] = useState('');
    const localRef = useRef(null);
    const remoteRef = useRef(null);
    const roomInput = useRef(null);
    const roomIDRef = useRef(roomID);
    const iceServers = {
      iceServers: ICE_SERVERS
    }
    //console.log("1")
    // prevent weird errors with roomid state
    useEffect(() => {
      roomIDRef.current = roomID; // Update the ref whenever roomID changes
      //roomDisplay.current.value = `Room: ${roomID}`
    }, [roomID]);

    //console.log('2')
    // establish peer
    useEffect(()=>{
      toast.warn("Video audio not currently supported... :(")
      const pc = new RTCPeerConnection(iceServers); // create peer
      // send out ice candidate from client
      pc.onicecandidate = (event) => {
        if (event.candidate) {
         // console.log("Received ICE candidate!")
          console.log("ICE CANDIDATE ROOMID",roomIDRef.current)
          socket.emit('ice-candidate', {candidate: event.candidate, roomID: roomIDRef.current}); // send candidate to signaling server
        }
      }
      pc.ontrack = async (event) => {

        //const rS = event.streams[0];
        await waitForSignalingState(pc);
        if (remoteRef.current && pc.signalingState === 'stable'){
         // console.log("Remote reference is not null")
          //console.log("Media Stream", event.streams[0])
          toast.success("Peer has started streaming")
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
    //console.log("3")
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
//console.log('4')

    useEffect(()=>{
      // handle on offer
      socket.on('offer', async ({sdp,roomID,type}) => {
        if (peerConnection.signalingState === 'stable' || peerConnection.signalingState === 'have-remote-offer'){
          //console.log("Receiving offer!")
         // console.log("Offer id",roomID)
          await peerConnection.setRemoteDescription(new RTCSessionDescription({sdp,type}))
          const answer = await peerConnection.createAnswer();
          await peerConnection.setLocalDescription(answer)
          socket.emit('answer', {sdp:answer.sdp, roomID: roomID, type:answer.type})
        }
      })

      socket.on('answer', async ({sdp,type})=>{
       // console.log("Received answer!")
        if (peerConnection.signalingState === 'have-local-offer'){
          await peerConnection.setRemoteDescription(new RTCSessionDescription({sdp,type}));
          //console.log("Setting remote description!")
        } else {
          console.warn("Cannot accept answer, signaling state isn't 'have-local-offer', instead is", peerConnection.signalingState)
        }
      })

      socket.on('ice-candidate', async (candidate)=>{
    //    console.log("ICE Candidate added to connection")
        if (peerConnection){
          await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
          //console.log("New IceCandidate added")
        }
      })

      socket.on('stream-stopped', ()=>{
        console.log("Peer has stopped streaming")
        toast.info("Peer has stopped streaming.")
        if (remoteRef.current){
          remoteRef.current.srcObject = null;
        }
        if (remoteStream){
          setRemoteStream(null);
        }
      })

      socket.on('room-created', async (roomID)=>{
        setRoomID(roomID)
        // roomInput.current.value = roomID
        toast.success("Successfully created room",roomID)
        await waitForSignalingState(peerConnection)
        await waitForIceConnection(peerConnection)
        //console.log("CREATED ROOM")
        socket.emit('clean-user', roomID)
       // console.log("Created and join room",roomID)
      })

      socket.on('join-confirmation',async ({status, message, id})=>{
        if (status == "ok"){
          setRoomID(id)
          toast.info("If peer has started streaming, please ask them to re-stream...")
          toast.success(`Successfully joined room ${id}`)
          await waitForSignalingState(peerConnection)
          await waitForIceConnection(peerConnection)
          socket.emit('clean-user', id)
        }
        else{
          console.warn(`Error: ${message}`)
          toast.error(`${message}`)
        }
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

const enterFullscreen = (videoElement) => {
  if (videoElement.requestFullscreen) {
    videoElement.requestFullscreen();
  } else if (videoElement.mozRequestFullScreen) { // Firefox
    videoElement.mozRequestFullScreen();
  } else if (videoElement.webkitRequestFullscreen) { // Chrome, Safari, Opera
    videoElement.webkitRequestFullscreen();
  } else if (videoElement.msRequestFullscreen) { // IE/Edge
    videoElement.msRequestFullscreen();
  }
};

    const handleInputChange = (e) => {
      setRoomID(e.target.value)
    }

    // function to start screen capture
    const startScreenCapture = async () => {
        try {
            if (roomID == null){
              toast.error("Please join or create a room first!")
              return;
            }
            const stream = await navigator.mediaDevices.getDisplayMedia({
                video: true
            });
            if (localRef.current){
              localRef.current.srcObject = stream;
            }

            await waitForSignalingState(peerConnection);

           // console.log("Adding Tracks!")
            stream.getTracks().forEach(track => peerConnection.addTrack(track, stream))
            const offer = await peerConnection.createOffer(); // yes.
            await peerConnection.setLocalDescription(offer);
            //console.log("Screen capture id", roomID)
            socket.emit('offer', {sdp: offer.sdp, roomID: roomID,type: offer.type});
            await waitForIceConnection(peerConnection);

            // now it propagates through signaling server. 
            // testing with same machine on different browsers.
            setScreenStream(stream)
            console.log("ICE Connection is stable!")  
            toast.success("Streaming has started...")
            
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
        toast.info("Stream is not active...")
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
      toast.info("Stopping the stream...")
    }

    // developmental purposes: display all rooms
    const display = () =>{
      socket.emit("display")
    }


    const joinRoom = () => {
        const input = roomID
        if (input){
          socket.emit('join-room', input)
        } else {
          toast.error("You need to enter a room id!")
          console.log("Invalid input!")
        }
        //console.log("Setting value to", roomInput.current.value)
      
    }

    const createRoom = () => {
      stopCapture();
      socket.emit('create-room');
    }
    //console.log('5')
    return (
      <Container maxWidth="md" style={{ textAlign: 'center', marginTop: '50px' }}>
        <Typography variant="h4" gutterBottom>
          Peek: Screen-sharing made simple!
        </Typography>
  
      
        <Box sx={{ marginBottom: '20px' }}>
          <TextField
            inputRef={roomInput}
            label="Enter Room ID"
            variant="outlined"
            value={roomID}
            onChange={handleInputChange}
            style={{ marginBottom: '20px' }}
          />
          <Grid container spacing={2} justifyContent="center">
            <Grid item>
              <Button variant="contained" color="primary" onClick={joinRoom}>
                Join Room
              </Button>
            </Grid>
            <Grid item>
              <Button variant="contained" color="secondary" onClick={createRoom}>
                Create Room
              </Button>
            </Grid>
          </Grid>
        </Box>
  
        <Grid container spacing={2} justifyContent="center" sx={{ marginBottom: '20px' }}>
          <Grid item>
            <Button variant="contained" color="success" onClick={startScreenCapture}>
              Start Screen Share
            </Button>
          </Grid>
          <Grid item>
            <Button variant="contained" color="error" onClick={stopCapture}>
              Stop Screen Share
            </Button>
          </Grid>
        </Grid>
  
        <Grid container spacing={2}>
          <Grid item xs={12} md={6}>
          <Typography variant="h6">Your Screen</Typography>

          <IconButton onClick={() => enterFullscreen(localRef.current)} aria-label="Fullscreen local screen">
          <FullscreenIcon />
           </IconButton>
            
            <video ref={localRef} style={{ width: '100%', border: '1px solid #ccc' }} autoPlay muted />
          </Grid>
          <Grid item xs={12} md={6}>
          <Typography variant="h6">Remote Screen</Typography>

          <IconButton onClick={() => enterFullscreen(remoteRef.current)} aria-label="Fullscreen local screen">
          <FullscreenIcon />
           </IconButton>
            <video ref={remoteRef} style={{ width: '100%', border: '1px solid #ccc' }} autoPlay muted />
          </Grid>
        </Grid>
        <ToastContainer/>
      </Container>
    );
}

export default App;
