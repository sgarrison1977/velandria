// draws a sword cursor (tip at top-left = click point) to a PNG data URL and installs it as --cur
export function installCursor() {
  const K = 1.15, S = 42, c = document.createElement("canvas"); c.width = c.height = S;
  const g = c.getContext("2d");
  g.scale(K, K); g.translate(2, 2); g.rotate(-Math.PI / 4); g.translate(0, 0);
  // local frame: sword points up along -y from origin (tip at 0,0)
  const blade = new Path2D("M0 0 L3.2 5 L3.2 26 L-3.2 26 L-3.2 5 Z");
  const guard = new Path2D("M-9 26 Q0 24 9 26 L9 29.5 Q0 28 -9 29.5 Z");
  const grip = new Path2D("M-1.9 29.5 L1.9 29.5 L1.9 38 L-1.9 38 Z");
  g.translate(0, 0); g.save(); g.scale(1, 1);
  g.lineJoin = "round";
  for (const p of [blade, guard, grip]) { g.lineWidth = 3; g.strokeStyle = "rgba(255,244,208,0.85)"; g.stroke(p); }
  g.beginPath(); g.arc(0, 40.5, 3.4, 0, Math.PI * 2); g.lineWidth = 3; g.stroke();
  const bl = g.createLinearGradient(-3, 0, 3, 0); bl.addColorStop(0, "#8a909a"); bl.addColorStop(0.45, "#ffffff"); bl.addColorStop(0.55, "#c8ced8"); bl.addColorStop(1, "#5a5e66");
  g.fillStyle = bl; g.fill(blade);
  g.strokeStyle = "#7a808a"; g.lineWidth = 0.8; g.beginPath(); g.moveTo(0, 6); g.lineTo(0, 24); g.stroke();
  const gd = g.createLinearGradient(0, 24, 0, 30); gd.addColorStop(0, "#fff2c4"); gd.addColorStop(0.5, "#d8a83e"); gd.addColorStop(1, "#6a4210");
  g.fillStyle = gd; g.fill(guard);
  g.fillStyle = "#4a2a14"; g.fill(grip);
  g.strokeStyle = "#2a160a"; g.lineWidth = 0.7; for (let y = 31; y < 38; y += 2) { g.beginPath(); g.moveTo(-1.9, y); g.lineTo(1.9, y + 1); g.stroke(); }
  g.beginPath(); g.arc(0, 40.5, 3.2, 0, Math.PI * 2); g.fillStyle = gd; g.fill();
  g.lineWidth = 1.1; g.strokeStyle = "#140c06";
  for (const p of [blade, guard, grip]) g.stroke(p);
  g.beginPath(); g.arc(0, 40.5, 3.2, 0, Math.PI * 2); g.stroke();
  g.restore();
  document.documentElement.style.setProperty("--cur", `url(${c.toDataURL("image/png")}) 2 2, auto`);
}
