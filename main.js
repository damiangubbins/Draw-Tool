// ============================================================
// Dibujador de dígitos "estilo MNIST"
//
// MNIST no es solo "achicar la imagen a 28x28". Cada dígito fue:
//   1. Recortado a su bounding box (el rectángulo que lo contiene)
//   2. Escalado para que su lado más largo mida 20 px (manteniendo proporción)
//   3. Pegado en un cuadro de 28x28, centrado según su centro de masa
// Además, los trazos de MNIST tienen un grosor parecido (~2-3 px) y bordes suaves.
// Si no hacemos lo mismo, la red ve dígitos corridos, chicos o muy finos
// y se equivoca aunque el dibujo se vea bien.
// ============================================================

const canvas = document.getElementById("draw-canvas");
const ctx = canvas.getContext("2d");
const preview = document.getElementById("preview-canvas");
const pctx = preview.getContext("2d");

const BRUSH = 22; // grosor del pincel (en el canvas de 280x280)

ctx.lineWidth = BRUSH;
ctx.lineCap = "round"; // puntas redondeadas
ctx.lineJoin = "round"; // uniones redondeadas (sin esquinas)
ctx.strokeStyle = "white";
ctx.fillStyle = "white";

let drawing = false;
let last = null; // última posición del puntero
let strokes = []; // lista de trazos; cada trazo es una lista de puntos {x, y}

// Posición del puntero dentro del canvas (corrige si el canvas está escalado por CSS)
function pos(e) {
  const r = canvas.getBoundingClientRect();
  return {
    x: ((e.clientX - r.left) * canvas.width) / r.width,
    y: ((e.clientY - r.top) * canvas.height) / r.height,
  };
}

// Pointer events: funcionan con mouse, touch y lápiz
canvas.addEventListener("pointerdown", (e) => {
  drawing = true;
  canvas.setPointerCapture(e.pointerId); // sigue dibujando aunque el puntero salga del canvas
  last = pos(e);
  strokes.push([last]); // empieza un trazo nuevo
  ctx.beginPath();
  ctx.arc(last.x, last.y, BRUSH / 2, 0, Math.PI * 2); // un punto, por si solo hace click
  ctx.fill();
});

canvas.addEventListener("pointermove", (e) => {
  if (!drawing) return;
  const p = pos(e);
  ctx.beginPath();
  ctx.moveTo(last.x, last.y);
  ctx.lineTo(p.x, p.y); // línea continua (con círculos sueltos quedan huecos si mueves rápido)
  ctx.stroke();
  strokes[strokes.length - 1].push(p); // guarda el punto en el trazo actual
  last = p;
});

for (const type of ["pointerup", "pointercancel"]) {
  canvas.addEventListener(type, () => {
    if (!drawing) return;
    drawing = false;
    drawPreview(toMNIST()); // actualiza la vista 28x28 al terminar cada trazo
  });
}

function clearCanvas() {
  ctx.save();
  ctx.fillStyle = "black";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.restore();
  strokes = [];
  drawPreview(new Float32Array(784));
  document.getElementById("output").value = "";
  document.getElementById("copied").style.display = "none";
}

// ------------------------------------------------------------
// Convierte el dibujo en 784 valores entre 0 y 1, como MNIST.
// En vez de achicar la imagen grande, volvemos a dibujar los trazos
// directamente en 28x28. Así el grosor queda igual sin importar si
// el alumno dibujó grande o chico.
// ------------------------------------------------------------
const STROKE_28 = 2.6; // grosor del trazo en 28x28 (similar a MNIST)

function toMNIST() {
  if (strokes.length === 0) return new Float32Array(784);

  // 1. Bounding box de todos los puntos dibujados
  const all = strokes.flat();
  const xs = all.map((p) => p.x);
  const ys = all.map((p) => p.y);
  const minX = Math.min(...xs), maxX = Math.max(...xs);
  const minY = Math.min(...ys), maxY = Math.max(...ys);

  // 2. Escala para que el dígito (incluyendo el grosor del trazo) mida 20 px en su lado más largo
  const size = Math.max(maxX - minX, maxY - minY, 1);
  const scale = (20 - STROKE_28) / size;

  // Dibuja los trazos en un canvas de 28x28, con el punto (cx, cy) del dibujo en el centro
  function render(cx, cy) {
    const c = document.createElement("canvas");
    c.width = c.height = 28;
    const g = c.getContext("2d");
    g.fillStyle = "black";
    g.fillRect(0, 0, 28, 28);
    g.strokeStyle = g.fillStyle = "white";
    g.lineWidth = STROKE_28;
    g.lineCap = g.lineJoin = "round";
    const tx = (x) => 14 + (x - cx) * scale;
    const ty = (y) => 14 + (y - cy) * scale;
    for (const s of strokes) {
      g.beginPath();
      if (s.length === 1) {
        g.arc(tx(s[0].x), ty(s[0].y), STROKE_28 / 2, 0, Math.PI * 2); // punto suelto
        g.fill();
      } else {
        g.moveTo(tx(s[0].x), ty(s[0].y));
        for (const p of s) g.lineTo(tx(p.x), ty(p.y));
        g.stroke();
      }
    }
    const d = g.getImageData(0, 0, 28, 28).data;
    return Float32Array.from({ length: 784 }, (_, i) => d[i * 4] / 255);
  }

  // 3. Primera pasada: centrado según el bounding box
  const bx = (minX + maxX) / 2;
  const by = (minY + maxY) / 2;
  const first = render(bx, by);

  // 4. Centro de masa (promedio de posiciones, ponderado por intensidad)
  let total = 0, mx = 0, my = 0;
  for (let i = 0; i < 784; i++) {
    total += first[i];
    mx += (i % 28) * first[i];
    my += Math.floor(i / 28) * first[i];
  }
  mx /= total;
  my /= total;

  // 5. Segunda pasada: corrida para que el centro de masa quede en el centro (13.5, 13.5)
  return render(bx + (mx - 13.5) / scale, by + (my - 13.5) / scale);
}

// Muestra lo que realmente ve la red (28x28, ampliado con CSS)
function drawPreview(pixels) {
  const img = pctx.createImageData(28, 28);
  for (let i = 0; i < 784; i++) {
    const v = pixels[i] * 255;
    img.data[i * 4] = v;
    img.data[i * 4 + 1] = v;
    img.data[i * 4 + 2] = v;
    img.data[i * 4 + 3] = 255;
  }
  pctx.putImageData(img, 0, 0);
}

// Exporta los 784 valores separados por coma y los copia al portapapeles
async function export28() {
  const pixels = toMNIST();
  drawPreview(pixels);

  const csv = Array.from(pixels, (v) => +v.toFixed(3)).join(","); // "+" quita ceros sobrantes (0.000 -> 0)
  const output = document.getElementById("output");
  output.value = csv;

  try {
    await navigator.clipboard.writeText(csv);
    const copiedMsg = document.getElementById("copied");
    copiedMsg.style.display = "block";
    setTimeout(() => (copiedMsg.style.display = "none"), 1500);
  } catch (err) {
    console.error("Clipboard copy failed: ", err);
    output.select(); // si falla el portapapeles, al menos queda seleccionado para copiar a mano
  }
}

clearCanvas();