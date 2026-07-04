// Small helpers to turn arrays of numeric values into SVG path data,
// matching a fixed viewBox of width x height with left/right padding p.

export function sx(i, n, w, p) {
  return p + (i / (n - 1)) * (w - 2 * p);
}

export function sy(v, mn, mx, h, p) {
  return h - p - ((v - mn) / (mx - mn)) * (h - 2 * p);
}

export function linePath(vals, mn, mx, w, h, p) {
  return vals
    .map((v, i) => (i ? "L" : "M") + sx(i, vals.length, w, p).toFixed(1) + " " + sy(v, mn, mx, h, p).toFixed(1))
    .join(" ");
}

export function areaPath(vals, mn, mx, w, h, p) {
  const n = vals.length;
  const base = (h - p).toFixed(1);
  let d = "M " + sx(0, n, w, p).toFixed(1) + " " + base + " ";
  vals.forEach((v, i) => {
    d += "L " + sx(i, n, w, p).toFixed(1) + " " + sy(v, mn, mx, h, p).toFixed(1) + " ";
  });
  d += "L " + sx(n - 1, n, w, p).toFixed(1) + " " + base + " Z";
  return d;
}
