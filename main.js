const canvas = document.getElementById("draw-canvas");
const ctx = canvas.getContext("2d");
ctx.fillStyle = "black";
ctx.fillRect(0, 0, canvas.width, canvas.height);

let drawing = false;

canvas.addEventListener("mousedown", () => (drawing = true));
canvas.addEventListener("mouseup", () => (drawing = false));
canvas.addEventListener("mousemove", draw);

function draw(e) {
  if (!drawing) return;
  ctx.fillStyle = "white";
  ctx.beginPath();
  ctx.arc(e.offsetX, e.offsetY, 10, 0, Math.PI * 2);
  ctx.fill();
}

function clearCanvas() {
  ctx.fillStyle = "black";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  document.getElementById("output").value = "";
  document.getElementById("copied").style.display = "none";
}

async function export28() {
  const smallCanvas = document.createElement("canvas");
  smallCanvas.width = 28;
  smallCanvas.height = 28;
  const smallCtx = smallCanvas.getContext("2d");

  smallCtx.drawImage(canvas, 0, 0, 28, 28);

  const imgData = smallCtx.getImageData(0, 0, 28, 28).data;

  let pixels = [];
  for (let i = 0; i < imgData.length; i += 4) {
    const r = imgData[i];
    const g = imgData[i + 1];
    const b = imgData[i + 2];
    const gray = (r + g + b) / 3;
    const norm = (gray / 255).toFixed(3);
    pixels.push(norm);
  }

  const csv = pixels.join(",");
  const output = document.getElementById("output");
  output.value = csv;

  try {
    await navigator.clipboard.writeText(csv);
    const copiedMsg = document.getElementById("copied");
    copiedMsg.style.display = "block";
    setTimeout(() => (copiedMsg.style.display = "none"), 1500);
  } catch (err) {
    console.error("Clipboard copy failed: ", err);
  }
}
