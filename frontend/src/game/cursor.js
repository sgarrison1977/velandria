// draws the gauntlet-style arrow cursor to a PNG data URL and installs it as --cur
export function installCursor() {
  const c = document.createElement("canvas"); c.width = c.height = 32;
  const g = c.getContext("2d");
  const arrow = new Path2D("M2 2 L2 24 L8 18.5 L12.5 28 L17 26 L12.6 16.8 L20.5 16.5 Z");
  g.save(); g.translate(1.2, 1.2); g.fillStyle = "rgba(10,6,2,0.55)"; g.fill(arrow); g.restore();
  const m = g.createLinearGradient(2, 2, 20, 28);
  m.addColorStop(0, "#fff2c4"); m.addColorStop(0.35, "#d8a83e"); m.addColorStop(0.7, "#8a5a1a"); m.addColorStop(1, "#4a2e0c");
  g.fillStyle = m; g.fill(arrow);
  g.lineWidth = 1.4; g.lineJoin = "round"; g.strokeStyle = "#1a1006"; g.stroke(arrow);
  const st = g.createLinearGradient(0, 5, 0, 20); st.addColorStop(0, "rgba(207,212,220,0.6)"); st.addColorStop(1, "rgba(90,94,102,0.6)");
  g.fillStyle = st; g.fill(new Path2D("M3.6 5.5 L3.6 19.5 L7.6 15.8 L16 15.4 Z"));
  g.strokeStyle = "rgba(255,248,220,0.8)"; g.lineWidth = 0.9; g.beginPath(); g.moveTo(3, 3.2); g.lineTo(10, 10); g.stroke();
  const gem = g.createRadialGradient(6.8, 12.6, 0, 7.4, 13.2, 2.4); gem.addColorStop(0, "#ffffff"); gem.addColorStop(0.4, "#5ab8ff"); gem.addColorStop(1, "#123a6a");
  g.fillStyle = gem; g.beginPath(); g.arc(7.4, 13.2, 2.3, 0, Math.PI * 2); g.fill(); g.lineWidth = 0.8; g.strokeStyle = "#1a1006"; g.stroke();
  document.documentElement.style.setProperty("--cur", `url(${c.toDataURL("image/png")}) 2 2, auto`);
}
