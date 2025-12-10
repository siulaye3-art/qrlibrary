let video = document.getElementById("video");
let resultBox = document.getElementById("result");
let stream;
let scanning = false;

document.getElementById("startScan").onclick = () => {
    startScanner();
};

document.getElementById("stopScan").onclick = () => {
    stopScanner();
};

async function startScanner() {
    try {
        stream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: "environment" }
        });

        video.srcObject = stream;
        video.setAttribute("playsinline", true);
        scanning = true;
        scanLoop();
    } catch (err) {
        resultBox.innerText = "Camera error: " + err;
    }
}

function stopScanner() {
    scanning = false;
    if (stream) {
        stream.getTracks().forEach(t => t.stop());
    }
    resultBox.innerText = "Scanner stopped.";
}

function scanLoop() {
    if (!scanning) return;

    requestAnimationFrame(scanLoop);

    let canvas = document.createElement("canvas");
    let ctx = canvas.getContext("2d");

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    let imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    let code = jsQR(imageData.data, canvas.width, canvas.height);

    if (code) {
        scanning = false;
        stopScanner();
        resultBox.innerHTML = `<b>Scanned:</b> ${code.data}`;
    }
}
