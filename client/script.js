const socket = io();

document.getElementById('startCapture').addEventListener('click', async () => {
    try {
        const stream = await navigator.mediaDevices.getDisplayMedia({
            video: true
        });
        console.log('Screen capture started');
        // sends captured video via webrtc
    } catch (err) {
        console.error('Error capturing screen:', err);
    }
});
