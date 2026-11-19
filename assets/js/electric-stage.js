/* ==========================================================================
   Rodriguez Lawn & Landscape — Electric SDF brand stage
   Vanilla WebGL2 port of the ElectricLogo technique (React Bits / OGL).
   No external imports: CSP-safe, works on Cloudflare Pages as-is.
   ========================================================================== */
(function () {
  'use strict';

  var container = document.getElementById('electricLogo');
  if (!container) return;

  var svg = document.getElementById('brandCrest');
  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  var RASTER = 560;
  var CELL = 4;
  var FAR = 1e20;
  var ARCS = 5;
  var PULSES = 3;
  var PIXEL_BUDGET = 4e6;

  /* ---------- settings ---------- */
  var settings = {
    color: '#F6E2B3',
    glowColor: '#4ADE80',
    scale: 0.72,
    intensity: 1.25,
    glow: 1.15,
    thickness: 1.6,
    strands: 4,
    bend: 0.62,
    crackle: 1.55,
    arcs: 3,
    flicker: 0.6,
    fill: 0.08,
    speed: 2.2,
    interactive: true,
    cursorIntensity: 0.82,
    cursorRadius: 110,
    theme: 'dark'
  };

  /* ---------- SDF helpers (ported verbatim) ---------- */
  function hexToRgb(hex) {
    var h = String(hex || '').replace('#', '');
    if (h.length === 3) h = h.replace(/./g, function (c) { return c + c; });
    var n = parseInt(h.slice(0, 6), 16);
    if (isNaN(n)) return [1, 1, 1];
    return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
  }

  function transformLine(f, d, v, z, n) {
    var k = 0;
    v[0] = 0;
    z[0] = -FAR;
    z[1] = FAR;
    for (var q = 1; q < n; q++) {
      var s = (f[q] + q * q - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]);
      while (s <= z[k]) {
        k--;
        s = (f[q] + q * q - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]);
      }
      k++;
      v[k] = q;
      z[k] = s;
      z[k + 1] = FAR;
    }
    k = 0;
    for (q = 0; q < n; q++) {
      while (z[k + 1] < q) k++;
      d[q] = (q - v[k]) * (q - v[k]) + f[v[k]];
    }
  }

  function transformGrid(grid, w, h) {
    var n = Math.max(w, h);
    var f = new Float64Array(n);
    var d = new Float64Array(n);
    var v = new Int32Array(n);
    var z = new Float64Array(n + 1);
    for (var x = 0; x < w; x++) {
      for (var y = 0; y < h; y++) f[y] = grid[y * w + x];
      transformLine(f, d, v, z, h);
      for (y = 0; y < h; y++) grid[y * w + x] = d[y];
    }
    for (y = 0; y < h; y++) {
      for (x = 0; x < w; x++) f[x] = grid[y * w + x];
      transformLine(f, d, v, z, w);
      for (x = 0; x < w; x++) grid[y * w + x] = d[x];
    }
  }

  function blurLine(src, dst, offset, stride, n, r) {
    var scale = 1 / (2 * r + 1);
    var sum = 0;
    for (var i = 0; i <= r && i < n; i++) sum += src[offset + i * stride];
    for (i = 0; i < n; i++) {
      dst[offset + i * stride] = sum * scale;
      if (i + r + 1 < n) sum += src[offset + (i + r + 1) * stride];
      if (i - r >= 0) sum -= src[offset + (i - r) * stride];
    }
  }

  function blurGrid(grid, w, h, r) {
    var tmp = new Float32Array(w * h);
    for (var pass = 0; pass < 3; pass++) {
      for (var y = 0; y < h; y++) blurLine(grid, tmp, y * w, 1, w, r);
      for (var x = 0; x < w; x++) blurLine(tmp, grid, x, w, h, r);
    }
  }

  function readCoverage(data, w, h) {
    var coverage = new Float32Array(w * h);
    var clear = 0;
    for (var i = 0; i < w * h; i++) if (data[i * 4 + 3] < 250) clear++;
    if (clear > w * h * 0.01) {
      for (i = 0; i < w * h; i++) coverage[i] = data[i * 4 + 3] / 255;
      return coverage;
    }
    var r = 0, g = 0, b = 0, n = 0;
    function sample(i) { r += data[i * 4]; g += data[i * 4 + 1]; b += data[i * 4 + 2]; n++; }
    for (var x = 0; x < w; x++) { sample(x); sample((h - 1) * w + x); }
    for (var y = 0; y < h; y++) { sample(y * w); sample(y * w + w - 1); }
    r /= n; g /= n; b /= n;
    for (i = 0; i < w * h; i++) {
      var diff = Math.max(Math.abs(data[i * 4] - r), Math.abs(data[i * 4 + 1] - g), Math.abs(data[i * 4 + 2] - b));
      coverage[i] = Math.min(1, Math.max(0, (diff - 24) / 48));
    }
    return coverage;
  }

  function traceShape(image) {
    var iw = image.naturalWidth || image.width;
    var ih = image.naturalHeight || image.height;
    if (!iw || !ih) return null;
    var fit = RASTER / Math.max(iw, ih);
    var w = Math.max(2, Math.round(iw * fit));
    var h = Math.max(2, Math.round(ih * fit));
    var canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    var ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return null;
    ctx.drawImage(image, 0, 0, w, h);
    var coverage = readCoverage(ctx.getImageData(0, 0, w, h).data, w, h);

    var left = w, top = h, right = -1, bottom = -1;
    for (var y = 0; y < h; y++) {
      for (var x = 0; x < w; x++) {
        if (coverage[y * w + x] <= 0.01) continue;
        if (x < left) left = x;
        if (x > right) right = x;
        if (y < top) top = y;
        if (y > bottom) bottom = y;
      }
    }
    if (right < 0) return null;

    var logoWidth = right - left + 1;
    var logoHeight = bottom - top + 1;
    var pad = Math.ceil(Math.max(logoWidth, logoHeight) * 0.25) + 2;
    var width = logoWidth + pad * 2;
    var height = logoHeight + pad * 2;
    var outer = new Float32Array(width * height);
    var inner = new Float32Array(width * height);
    for (y = 0; y < height; y++) {
      for (x = 0; x < width; x++) {
        var sx = x - pad + left;
        var sy = y - pad + top;
        var a = (sx >= 0 && sy >= 0 && sx < w && sy < h) ? coverage[sy * w + sx] : 0;
        var i = y * width + x;
        if (a >= 1) { outer[i] = 0; inner[i] = FAR; }
        else if (a <= 0) { outer[i] = FAR; inner[i] = 0; }
        else {
          var e = 0.5 - a;
          outer[i] = e > 0 ? e * e : 0;
          inner[i] = e < 0 ? e * e : 0;
        }
      }
    }
    transformGrid(outer, width, height);
    transformGrid(inner, width, height);

    var field = new Float32Array(width * height);
    for (i = 0; i < width * height; i++) field[i] = Math.sqrt(outer[i]) - Math.sqrt(inner[i]);

    var points = [];
    for (y = 1; y < height - 1; y++) {
      for (x = 1; x < width - 1; x++) {
        i = y * width + x;
        var d = field[i];
        if (d > 0) continue;
        if (field[i - 1] <= 0 && field[i + 1] <= 0 && field[i - width] <= 0 && field[i + width] <= 0) continue;
        var gx = field[i + 1] - field[i - 1];
        var gy = field[i + width] - field[i - width];
        var len = Math.hypot(gx, gy) || 1;
        points.push(x + 0.5 - (d * gx) / len, y + 0.5 - (d * gy) / len);
      }
    }
    var stride = Math.max(1, Math.ceil(points.length / 2 / 3000)) * 2;
    var edges = [];
    for (i = 0; i < points.length; i += stride) { edges.push(points[i], points[i + 1]); }

    var size = Math.max(logoWidth, logoHeight);
    var glowPad = Math.ceil((size * 0.7) / CELL);
    var glowWidth = Math.ceil(logoWidth / CELL) + glowPad * 2;
    var glowHeight = Math.ceil(logoHeight / CELL) + glowPad * 2;
    var tight = new Float32Array(glowWidth * glowHeight);
    for (y = 0; y < height; y++) {
      var gy = Math.floor((y - pad) / CELL) + glowPad;
      for (x = 0; x < width; x++) {
        var gx = Math.floor((x - pad) / CELL) + glowPad;
        tight[gy * glowWidth + gx] += Math.exp(-Math.abs(field[y * width + x]) / 1.5) / (CELL * CELL);
      }
    }
    var wide = tight.slice();
    var tightRadius = Math.max(1, Math.round((size * 0.035) / CELL));
    var wideRadius = Math.max(2, Math.round((size * 0.13) / CELL));
    blurGrid(tight, glowWidth, glowHeight, tightRadius);
    blurGrid(wide, glowWidth, glowHeight, wideRadius);
    var tightNorm = (Math.sqrt(2 * Math.PI * (tightRadius * tightRadius + tightRadius)) * CELL) / 3;
    var wideNorm = (Math.sqrt(2 * Math.PI * (wideRadius * wideRadius + wideRadius)) * CELL) / 3;
    var glow = new Float32Array(glowWidth * glowHeight * 2);
    for (i = 0; i < glowWidth * glowHeight; i++) {
      glow[i * 2] = tight[i] * tightNorm;
      glow[i * 2 + 1] = wide[i] * wideNorm;
    }

    return {
      field: field,
      edges: edges,
      width: width,
      height: height,
      pad: pad,
      logoWidth: logoWidth,
      logoHeight: logoHeight,
      glow: glow,
      glowWidth: glowWidth,
      glowHeight: glowHeight,
      glowOffset: pad - glowPad * CELL
    };
  }

  function sampleField(shape, x, y) {
    var field = shape.field, width = shape.width, height = shape.height;
    var cx = Math.min(Math.max(x, 0.5), width - 0.5);
    var cy = Math.min(Math.max(y, 0.5), height - 0.5);
    var x0 = Math.min(Math.floor(cx - 0.5), width - 2);
    var y0 = Math.min(Math.floor(cy - 0.5), height - 2);
    var tx = cx - 0.5 - x0;
    var ty = cy - 0.5 - y0;
    var i = y0 * width + x0;
    var top = field[i] + (field[i + 1] - field[i]) * tx;
    var bottom = field[i + width] + (field[i + width + 1] - field[i + width]) * tx;
    return top + (bottom - top) * ty + Math.hypot(x - cx, y - cy);
  }

  function spawnArc(shape, time, focus) {
    var edges = shape.edges, logoWidth = shape.logoWidth, logoHeight = shape.logoHeight;
    var count = edges.length / 2;
    if (count < 2) return null;
    var size = Math.max(logoWidth, logoHeight);
    var i = Math.floor(Math.random() * count);
    if (focus) {
      var found = false;
      for (var attempt = 0; attempt < 40 && !found; attempt++) {
        var j = Math.floor(Math.random() * count);
        if (Math.hypot(edges[j * 2] - focus.x, edges[j * 2 + 1] - focus.y) < focus.radius) {
          i = j;
          found = true;
        }
      }
      if (!found) return null;
    }
    var ax = edges[i * 2];
    var ay = edges[i * 2 + 1];
    for (attempt = 0; attempt < 24; attempt++) {
      j = Math.floor(Math.random() * count);
      var bx = edges[j * 2];
      var by = edges[j * 2 + 1];
      var len = Math.hypot(bx - ax, by - ay);
      if (len < size * 0.08 || len > size * 0.3) continue;
      var nx = -(by - ay) / len;
      var ny = (bx - ax) / len;
      var bow = len * (0.2 + Math.random() * 0.3);
      var mx = (ax + bx) / 2;
      var my = (ay + by) / 2;
      var left = sampleField(shape, mx + nx * bow, my + ny * bow);
      var right = sampleField(shape, mx - nx * bow, my - ny * bow);
      if (Math.max(left, right) <= 0) continue;
      return {
        ax: ax, ay: ay, bx: bx, by: by,
        bow: left >= right ? bow : -bow,
        seed: 1 + Math.random() * 60,
        born: time,
        life: 0.35 + Math.random() * 0.45
      };
    }
    return null;
  }

  /* ---------- WebGL2 setup ---------- */
  var gl = null;
  try {
    gl = container.appendChild(document.createElement('canvas')).getContext('webgl2', {
      alpha: true, premultipliedAlpha: true, antialias: false
    });
  } catch (e) { gl = null; }

  // move canvas to fill container and create it properly
  var canvas = document.createElement('canvas');
  // remove the probe canvas if any
  while (container.firstChild) container.removeChild(container.firstChild);
  if (!gl) {
    try { gl = canvas.getContext('webgl2', { alpha: true, premultipliedAlpha: true, antialias: false }); } catch (e) { gl = null; }
  }
  if (!gl) {
    // graceful fallback: show the SVG
    if (svg) { svg.style.position = 'absolute'; svg.style.inset = '0'; svg.style.width = '100%'; svg.style.height = '100%'; svg.style.display = 'block'; }
    return;
  }
  container.appendChild(canvas);
  gl.clearColor(0, 0, 0, 0);

  var floatLinear = !!gl.getExtension('OES_texture_float_linear');

  function createFieldTexture(w, h) {
    var tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, floatLinear ? gl.LINEAR : gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, floatLinear ? gl.LINEAR : gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.R32F, w, h, 0, gl.RED, gl.FLOAT, null);
    return tex;
  }
  function createGlowTexture(w, h) {
    var tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, floatLinear ? gl.LINEAR : gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, floatLinear ? gl.LINEAR : gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RG32F, w, h, 0, gl.RG, gl.FLOAT, null);
    return tex;
  }

  /* ---------- shaders ---------- */
  var vertexSrc = '#version 300 es\n' +
    'in vec2 position;\n' +
    'in vec2 uv;\n' +
    'out vec2 vUv;\n' +
    'void main() {\n' +
    '  vUv = uv;\n' +
    '  gl_Position = vec4(position, 0.0, 1.0);\n' +
    '}\n';

  var fragmentSrc = '#version 300 es\n' +
    'precision highp float;\n' +
    'precision highp int;\n' +
    'uniform sampler2D tField;\n' +
    'uniform sampler2D tGlow;\n' +
    'uniform vec4 uMap;\n' +
    'uniform vec4 uSize;\n' +
    'uniform vec2 uResolution;\n' +
    'uniform float uUnit;\n' +
    'uniform float uTime;\n' +
    'uniform float uPresence;\n' +
    'uniform vec3 uHover;\n' +
    'uniform float uHoverRadius;\n' +
    'uniform vec4 uPulses[' + PULSES + '];\n' +
    'uniform float uPulseBoost;\n' +
    'uniform float uFlash;\n' +
    'uniform vec3 uColor;\n' +
    'uniform vec3 uGlowColor;\n' +
    'uniform float uIntensity;\n' +
    'uniform float uGlow;\n' +
    'uniform float uThickness;\n' +
    'uniform float uStrands;\n' +
    'uniform float uBend;\n' +
    'uniform float uCrackle;\n' +
    'uniform float uFlicker;\n' +
    'uniform float uFill;\n' +
    'uniform float uInk;\n' +
    'uniform vec4 uArcEnds[' + ARCS + '];\n' +
    'uniform vec4 uArcShape[' + ARCS + '];\n' +
    'in vec2 vUv;\n' +
    'out vec4 fragColor;\n' +
    /* scramble */ 'uint scramble(uint x) {\n' +
    '  x ^= x >> 16u; x *= 0x7feb352du; x ^= x >> 15u; x *= 0x846ca68bu; x ^= x >> 16u; return x;\n' +
    '}\n' +
    'float fieldAt(sampler2D tex, vec4 map, vec4 size, vec2 p) {\n' +
    '  vec2 f = (p - map.xy) / map.z;\n' +
    '  vec2 c = clamp(f, vec2(0.5), size.xy - 0.5);\n' +
    '  return (textureLod(tex, c / size.xy, 0.0).r + length(f - c)) * map.z;\n' +
    '}\n' +
    'vec2 glowAt(sampler2D tex, vec4 map, vec4 size, vec2 p) {\n' +
    '  vec2 f = (p - map.xy) / map.z - map.w;\n' +
    '  return textureLod(tex, f / (size.zw * ' + CELL + '.0), 0.0).rg;\n' +
    '}\n' +
    'float shape(vec2 p, float k) { return fieldAt(tField, uMap, uSize, p); }\n' +
    'vec2 aura(vec2 p, float k) { return glowAt(tGlow, uMap, uSize, p); }\n' +
    /* corner/drift */ 'vec4 corner(ivec2 c, uint seed) {\n' +
    '  uint h = scramble(uint(c.x) * 0x8da6b343u + uint(c.y) * 0xd8163841u + seed * 0xcb1ab31fu);\n' +
    '  return vec4(uvec4(h, h >> 8u, h >> 16u, h >> 24u) & 255u) / 127.5 - 1.0;\n' +
    '}\n' +
    'vec2 drift(vec2 p, uint seed, out mat2 jac) {\n' +
    '  vec2 i = floor(p); vec2 f = p - i;\n' +
    '  vec2 u = f * f * f * (f * (f * 6.0 - 15.0) + 10.0);\n' +
    '  vec2 du = 30.0 * f * f * (f * (f - 2.0) + 1.0);\n' +
    '  ivec2 c = ivec2(i);\n' +
    '  vec4 ga = corner(c, seed); vec4 gb = corner(c + ivec2(1,0), seed); vec4 gc = corner(c + ivec2(0,1), seed); vec4 gd = corner(c + ivec2(1,1), seed);\n' +
    '  vec2 fb = f - vec2(1.0,0.0); vec2 fc = f - vec2(0.0,1.0); vec2 fd = f - vec2(1.0);\n' +
    '  vec2 va = vec2(dot(ga.xy,f), dot(ga.zw,f));\n' +
    '  vec2 vb = vec2(dot(gb.xy,fb), dot(gb.zw,fb));\n' +
    '  vec2 vc = vec2(dot(gc.xy,fc), dot(gc.zw,fc));\n' +
    '  vec2 vd = vec2(dot(gd.xy,fd), dot(gd.zw,fd));\n' +
    '  vec2 k = va - vb - vc + vd;\n' +
    '  vec4 g = ga + u.x*(gb-ga) + u.y*(gc-ga) + u.x*u.y*(ga-gb-gc+gd);\n' +
    '  jac = mat2(g.xy + du*(u.yx*k.x + vec2(vb.x-va.x, vc.x-va.x)), g.zw + du*(u.yx*k.y + vec2(vb.y-va.y, vc.y-va.y)));\n' +
    '  return va + u.x*(vb-va) + u.y*(vc-va) + u.x*u.y*k;\n' +
    '}\n' +
    'float wobble(vec2 p, uint seed) { mat2 jac; return drift(p, seed, jac).x; }\n' +
    /* ripple */ 'vec2 ripple(vec2 p, out float surge) {\n' +
    '  vec2 push = vec2(0.0); surge = 0.0;\n' +
    '  float width = uUnit * 10.0;\n' +
    '  for (int i = 0; i < ' + PULSES + '; i++) {\n' +
    '    vec4 pulse = uPulses[i]; if (pulse.w <= 0.0) continue;\n' +
    '    vec2 d = p - pulse.xy; float dist = length(d);\n' +
    '    float front = (dist - pulse.z * uUnit * 150.0) / width;\n' +
    '    float env = exp(-front*front) * pulse.w * exp(-pulse.z*1.7) * smoothstep(0.0, uUnit*8.0, dist);\n' +
    '    push += d / max(dist,1.0) * env * cos(front*2.2) * uUnit * 7.5;\n' +
    '    surge += env;\n' +
    '  }\n' +
    '  return push;\n' +
    '}\n' +
    /* wander */ 'vec2 wander(vec2 p, float t, uint seed, float reachScale, out mat2 jac, out vec2 sway) {\n' +
    '  vec2 q = p / uUnit;\n' +
    '  mat2 ja,jb,jc,jd;\n' +
    '  vec2 a = drift(q * 0.028 + vec2(t*0.29, t*0.21), seed, ja);\n' +
    '  vec2 b = drift(q * 0.085 + a*0.4 + vec2(t*0.83, -t*0.61) + 17.0, seed+1u, jb);\n' +
    '  vec2 c = drift(p/9.0 + b*0.6 + vec2(t*1.9, t*1.3) + 5.0, seed+2u, jc);\n' +
    '  vec2 d = drift(p/4.1 + vec2(-t*2.7, t*2.2) + 11.0, seed+3u, jd);\n' +
    '  float bendAmp = uBend * 8.0 * reachScale;\n' +
    '  float rippleAmp = uBend * 3.2 * reachScale;\n' +
    '  float crinkleAmp = uCrackle * 1.5 * reachScale;\n' +
    '  jac = ja*(0.028*bendAmp) + jb*(0.085*rippleAmp) + jc*(crinkleAmp/9.0) + jd*(crinkleAmp*0.35/4.1);\n' +
    '  sway = (a*bendAmp + b*rippleAmp) * uUnit;\n' +
    '  return sway + (c + d*0.35) * crinkleAmp;\n' +
    '}\n' +
    'vec2 glowShape(float line, float spread, float w) {\n' +
    '  float x = abs(line); float y = abs(spread);\n' +
    '  return vec2(exp(-x*x/(w*w*0.5)) + exp(-y/(w*2.2))*0.6, exp(-y/(w*4.5))*0.5);\n' +
    '}\n' +
    /* addArc */ 'void addArc(vec2 p, vec4 ends, vec4 info, float t, inout vec3 light, inout float energy, inout float hot) {\n' +
    '  if (info.y < 0.002) return;\n' +
    '  vec2 ab = ends.zw - ends.xy;\n' +
    '  float len = max(length(ab), 1.0);\n' +
    '  vec2 dir = ab / len;\n' +
    '  vec2 rel = p - ends.xy;\n' +
    '  float s = dot(rel, dir);\n' +
    '  float h = dot(rel, vec2(-dir.y, dir.x));\n' +
    '  float margin = abs(info.x) + uCrackle*(2.0 + len*0.08) + uThickness*12.0 + 10.0;\n' +
    '  if (s < -margin || s > len + margin || abs(h) > margin) return;\n' +
    '  float u = clamp(s / len, 0.0, 1.0);\n' +
    '  float taper = sin(3.14159265 * u);\n' +
    '  float bendSlope = (s > 0.0 && s < len) ? 3.14159265 / len * cos(3.14159265 * u) : 0.0;\n' +
    '  float beyond = max(-s,0.0) + max(s-len,0.0);\n' +
    '  for (int c = 0; c < 2; c++) {\n' +
    '    uint seed = uint(info.z * 131.0) + uint(c)*29u + 7u;\n' +
    '    float jag = 0.0, jagSlope = 0.0;\n' +
    '    float wave = max(len*0.3, 14.0);\n' +
    '    float weight = uCrackle * (1.5 + len*0.05) * (c == 0 ? 1.0 : 1.5);\n' +
    '    for (int o = 0; o < 3; o++) {\n' +
    '      mat2 jac; float n = drift(vec2(s / wave + info.z*3.0, t*(1.4 + float(o)*1.1)), seed + uint(o), jac).x;\n' +
    '      jag += n * weight; jagSlope += jac[0].x * weight / wave;\n' +
    '      wave *= 0.42; weight *= 0.4;\n' +
    '    }\n' +
    '    float offset = (info.x + jag) * taper;\n' +
    '    float offsetSlope = (info.x + jag) * bendSlope + jagSlope * taper;\n' +
    '    float across = (h - offset) / sqrt(1.0 + offsetSlope*offsetSlope);\n' +
    '    float gap = length(vec2(beyond, across));\n' +
    '    float w = uThickness * (c == 0 ? 0.9 : 0.6);\n' +
    '    vec2 g = glowShape(gap, gap, w);\n' +
    '    float k = info.y * (c == 0 ? 1.0 : 0.45);\n' +
    '    light += (uColor * g.x + uGlowColor * g.y * uGlow) * k;\n' +
    '    energy += (g.x + g.y * uGlow) * k;\n' +
    '    hot += exp(-gap*gap/(w*w*0.16)) * k * (c == 0 ? 1.0 : 0.0);\n' +
    '  }\n' +
    '}\n' +
    /* main */ 'void main() {\n' +
    '  vec2 p = vec2(vUv.x, 1.0 - vUv.y) * uResolution;\n' +
    '  float t = uTime;\n' +
    '  vec3 light = vec3(0.0); float energy = 0.0; float hot = 0.0;\n' +
    '  float surge; vec2 pr = p - ripple(p, surge);\n' +
    '  float k = 1.0;\n' +
    '  float transit = 0.0;\n' +
    '  float base = shape(pr, k);\n' +
    '  vec2 toHover = p - uHover.xy;\n' +
    '  float heat = min(uHover.z * exp(-dot(toHover,toHover)/(uHoverRadius*uHoverRadius)) + surge*1.4 + transit*0.5, 2.0);\n' +
    '  float heatCap = min(uHover.z + uPulseBoost*1.4 + transit*0.5, 2.0);\n' +
    '  float breath = 1.0 + uFlicker * 0.6 * wobble(vec2(t*2.1, 7.0), 3u);\n' +
    '  float grow = uPresence;\n' +
    '  float edge = abs(base);\n' +
    '  vec2 halo = aura(pr, k);\n' +
    '  float ink = uInk;\n' +
    '  float bloom = (halo.x*0.16 + halo.y*0.08) * (1.0 - ink*0.65) * uGlow * (1.0 + heat*1.2);\n' +
    '  float body = smoothstep(0.75, -0.75, base) * uFill * (0.06 + 1.2*min(halo.x,1.0)) * (1.0 + heat*0.5);\n' +
    '  light += uGlowColor * bloom * grow * grow;\n' +
    '  energy += bloom * grow * grow;\n' +
    '  float reachScale = mix(0.15, 1.0, grow) * (1.0 + heat*0.9);\n' +
    '  float reach = (uUnit * uBend * 16.0 + uCrackle * 3.0) * (1.0 + heatCap*0.9) + uThickness*20.0 + 8.0;\n' +
    '  if (edge < reach && grow > 0.0) {\n' +
    '    float fade = smoothstep(reach, reach*0.55, edge);\n' +
    '    vec2 q = pr / uUnit;\n' +
    '    float count = min(uStrands + heat*2.5, 6.0);\n' +
    '    float limit = min(uStrands + heatCap*2.5, 6.0);\n' +
    '    for (int i = 0; i < 6; i++) {\n' +
    '      float fi = float(i);\n' +
    '      if (fi >= limit) break;\n' +
    '      float present = clamp(count - fi, 0.0, 1.0);\n' +
    '      if (present <= 0.0) continue;\n' +
    '      uint seed = uint(i) * 7u + 3u;\n' +
    '      mat2 jac; vec2 sway;\n' +
    '      float lead = (i == 0) ? 1.0 : 0.0;\n' +
    '      vec2 warped = pr + wander(pr, t*(1.0 + fi*0.19), seed, reachScale*mix(0.6 + fi*0.2, 0.7, lead), jac, sway);\n' +
    '      float dw = shape(warped, k);\n' +
    '      vec2 slope = vec2(shape(warped + vec2(1.0,0.0), k), shape(warped + vec2(0.0,1.0), k)) - dw;\n' +
    '      float d = dw / max(length(slope + jac*slope), 0.3);\n' +
    '      float spread = shape(pr + sway, k);\n' +
    '      float swell = 0.5 + 0.5 * wobble(q*0.06 + vec2(t*0.9, fi*5.1 - t*0.6), seed + 8u);\n' +
    '      float w = uThickness * mix(0.5, 1.0, lead) * (0.5 + swell);\n' +
    '      float vis = mix(0.3 + 0.45*smoothstep(-0.25, 0.2, wobble(q*0.035 + vec2(t*0.21, fi*3.7), seed + 5u)), 1.0, lead);\n' +
    '      float spark = 1.0 - uFlicker * 0.3 * (0.5 + 0.5 * wobble(vec2(t*6.0, fi*2.3), seed + 6u));\n' +
    '      float weight = max(vis, heat*0.85) * spark * fade * present * (0.7 + 0.6*swell);\n' +
    '      vec2 g = glowShape(d, spread, w) * weight;\n' +
    '      float soft = mix(1.0, mix(0.5, 1.0, lead), ink);\n' +
    '      vec3 stroke = mix(uColor, uGlowColor, ink*(1.0-lead)*0.65);\n' +
    '      float haze = uGlow * (1.0 + heat) * (1.0 - ink*0.7);\n' +
    '      light += stroke * g.x * soft + uGlowColor * g.y * haze;\n' +
    '      energy += g.x * soft + g.y * haze;\n' +
    '      hot += exp(-d*d/(w*w*0.16)) * lead * weight;\n' +
    '    }\n' +
    '    light *= grow;\n' +
    '    energy *= grow;\n' +
    '  }\n' +
    '  for (int i = 0; i < ' + ARCS + '; i++) addArc(pr, uArcEnds[i], uArcShape[i], t, light, energy, hot);\n' +
    '  float gain = uIntensity * breath * (1.0 + heat*0.45) * (1.0 + uFlash*0.3) * 1.4;\n' +
    '  float alpha = 1.0 - exp(-energy * gain);\n' +
    '  vec3 color = mix(1.0 - exp(-light * gain), alpha * light / max(energy, 1e-4), ink);\n' +
    '  color = mix(color, vec3(alpha), clamp(hot * grow, 0.0, 1.0) * ink * 0.85);\n' +
    '  float tint = (1.0 - exp(-body * gain * 1.2)) * grow * grow * (1.0 - ink*0.82);\n' +
    '  color += uGlowColor * tint * (1.0 - alpha);\n' +
    '  alpha += tint * (1.0 - alpha);\n' +
    '  float grain = (fract(52.9829189 * fract(dot(gl_FragCoord.xy, vec2(0.06711056, 0.00583715)))) - 0.5) / 255.0;\n' +
    '  alpha = clamp(alpha + grain, 0.0, 1.0);\n' +
    '  fragColor = vec4(clamp(color + grain, 0.0, alpha), alpha);\n' +
    '}\n';

  function compileShader(type, src) {
    var sh = gl.createShader(type);
    gl.shaderSource(sh, src);
    gl.compileShader(sh);
    if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
      console.error('Shader compile error:', gl.getShaderInfoLog(sh));
      return null;
    }
    return sh;
  }

  var vs = compileShader(gl.VERTEX_SHADER, vertexSrc);
  var fs = compileShader(gl.FRAGMENT_SHADER, fragmentSrc);
  if (!vs || !fs) return;

  var program = gl.createProgram();
  gl.attachShader(program, vs);
  gl.attachShader(program, fs);
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    console.error('Program link error:', gl.getProgramInfoLog(program));
    return;
  }
  gl.useProgram(program);

  // fullscreen triangle
  var vao = gl.createVertexArray();
  gl.bindVertexArray(vao);
  var buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
    -1, -1, 0, 0,
     3, -1, 2, 0,
    -1,  3, 0, 2
  ]), gl.STATIC_DRAW);
  var posLoc = gl.getAttribLocation(program, 'position');
  gl.enableVertexAttribArray(posLoc);
  gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 16, 0);
  var uvLoc = gl.getAttribLocation(program, 'uv');
  gl.enableVertexAttribArray(uvLoc);
  gl.vertexAttribPointer(uvLoc, 2, gl.FLOAT, false, 16, 8);

  function U(name) { return gl.getUniformLocation(program, name); }

  // state
  var width = 1, height = 1;
  var time = 0;
  var progress = 0;
  var presence = 0;
  var morph = 1;
  var last = performance.now();
  var raf = 0;
  var visible = true;
  var settled = false;
  var resizePending = true;
  var hover = { x: 0, y: 0, vx: 0, vy: 0, power: 0 };
  var pointer = { x: 0, y: 0, over: false };
  var sparks = [];
  var pulses = [];
  var burst = null;
  var ink = 0;
  var hues = [[1, 1, 1], [1, 1, 1]];
  var shapeRef = null;
  var slot = { shape: null, fieldTex: null, glowTex: null };

  // load SVG into image
  var image = new Image();
  image.decoding = 'async';
  image.onload = function () {
    try {
      var traced = traceShape(image);
      if (traced) shapeRef = traced;
    } catch (e) { /* ignore */ }
  };
  if (svg) {
    try {
      image.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(new XMLSerializer().serializeToString(svg));
    } catch (e) {
      // fallback: hide nothing
    }
  }

  function loadShape(next) {
    if (slot.fieldTex && (slot.fieldTex.width !== next.width || slot.fieldTex.height !== next.height)) {
      gl.deleteTexture(slot.fieldTex);
      gl.deleteTexture(slot.glowTex);
      slot.fieldTex = null;
      slot.glowTex = null;
    }
    if (!slot.fieldTex) {
      slot.fieldTex = createFieldTexture(next.width, next.height);
      slot.glowTex = createGlowTexture(next.glowWidth, next.glowHeight);
    }
    gl.bindTexture(gl.TEXTURE_2D, slot.fieldTex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.R32F, next.width, next.height, 0, gl.RED, gl.FLOAT, next.field);
    gl.bindTexture(gl.TEXTURE_2D, slot.glowTex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RG32F, next.glowWidth, next.glowHeight, 0, gl.RG, gl.FLOAT, next.glow);
    slot.shape = next;
  }

  function place(shape, s) {
    var fit = Math.max(1e-4, Math.min((width * s.scale) / shape.logoWidth, (height * s.scale) / shape.logoHeight));
    return {
      fit: fit,
      ox: width / 2 - (shape.pad + shape.logoWidth / 2) * fit,
      oy: height / 2 - (shape.pad + shape.logoHeight / 2) * fit,
      unit: (Math.max(shape.logoWidth, shape.logoHeight) * fit) / 100
    };
  }

  function applyResize() {
    width = Math.max(1, container.clientWidth);
    height = Math.max(1, container.clientHeight);
    var dpr = Math.min(window.devicePixelRatio || 1, 2, Math.sqrt(PIXEL_BUDGET / (width * height)));
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    gl.viewport(0, 0, canvas.width, canvas.height);
  }

  var arcEnds = new Float32Array(ARCS * 4);
  var arcShape = new Float32Array(ARCS * 4);
  var pulseData = new Float32Array(PULSES * 4);

  function frame(now) {
    raf = 0;
    if (resizePending) {
      resizePending = false;
      applyResize();
    }
    var dt = Math.min(0.05, Math.max(0, (now - last) / 1000));
    last = now;

    if (shapeRef && slot.shape !== shapeRef) {
      try { loadShape(shapeRef); } catch (e) { /* ignore */ }
    }

    var to = slot.shape;
    if (!to) {
      if (visible) raf = requestAnimationFrame(frame);
      return;
    }

    progress = Math.min(1, progress + dt / 1.4);
    presence = progress * progress * (3 - 2 * progress);

    var s = settings;
    var near = place(to, s);
    var from = null;
    var blend = 1;
    var unit = near.unit;

    // hover smoothing
    var engaged = s.interactive && pointer.over;
    if (engaged && hover.power < 0.01) {
      hover.x = pointer.x;
      hover.y = pointer.y;
      hover.vx = 0;
      hover.vy = 0;
    }
    hover.vx += ((pointer.x - hover.x) * 120 - hover.vx * 19) * dt;
    hover.vy += ((pointer.y - hover.y) * 120 - hover.vy * 19) * dt;
    hover.x += hover.vx * dt;
    hover.y += hover.vy * dt;
    hover.power += ((engaged ? 1 : 0) - hover.power) * (1 - Math.exp(-dt / (engaged ? 0.3 : 0.55)));

    var motion = reduceMotion ? 0.2 : 1;
    time += dt * s.speed * motion;

    // sparks lifetime
    for (var i = sparks.length - 1; i >= 0; i--) {
      if (time - sparks[i].born > sparks[i].life) sparks.splice(i, 1);
    }
    function focus(spot) {
      return {
        x: (spot.x - near.ox) / near.fit,
        y: (spot.y - near.oy) / near.fit,
        radius: Math.max(1, s.cursorRadius) / near.fit
      };
    }
    if (burst && morph >= 1 && s.arcs > 0) {
      for (i = 0; i < 3 && sparks.length < ARCS; i++) {
        var sp = spawnArc(to, time, focus(burst));
        if (sp) sparks.push(sp);
      }
    }
    burst = null;
    if (!reduceMotion && presence > 0.8 && morph >= 1 && sparks.length < ARCS) {
      var chance = dt * s.speed * s.arcs;
      if (Math.random() < chance * 6 * hover.power * s.cursorIntensity) {
        sp = spawnArc(to, time, focus(hover));
        if (sp) sparks.push(sp);
      } else if (Math.random() < chance * 2.2) {
        sp = spawnArc(to, time, null);
        if (sp) sparks.push(sp);
      }
    }

    for (i = 0; i < ARCS; i++) {
      var o = i * 4;
      var spark = sparks[i];
      if (!spark) {
        arcShape[o + 1] = 0;
        continue;
      }
      var kAge = (time - spark.born) / spark.life;
      arcEnds[o] = near.ox + spark.ax * near.fit;
      arcEnds[o + 1] = near.oy + spark.ay * near.fit;
      arcEnds[o + 2] = near.ox + spark.bx * near.fit;
      arcEnds[o + 3] = near.oy + spark.by * near.fit;
      arcShape[o] = spark.bow * near.fit;
      arcShape[o + 1] = Math.sin(Math.PI * Math.min(1, Math.max(0, kAge))) * presence;
      arcShape[o + 2] = spark.seed;
    }

    // pulses
    var boost = 0;
    var flash = 0;
    for (i = pulses.length - 1; i >= 0; i--) {
      if ((now - pulses[i].born) / 1000 > 2) pulses.splice(i, 1);
    }
    for (i = 0; i < PULSES; i++) {
      o = i * 4;
      var pulse = pulses[i];
      if (!pulse) {
        pulseData[o + 3] = 0;
        continue;
      }
      var age = (now - pulse.born) / 1000;
      pulseData[o] = pulse.x;
      pulseData[o + 1] = pulse.y;
      pulseData[o + 2] = age;
      pulseData[o + 3] = 1;
      boost = Math.max(boost, Math.exp(-age * 1.7));
      flash += Math.exp(-age * 7);
    }

    // uniforms
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, slot.fieldTex);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, slot.glowTex);
    gl.uniform1i(U('tField'), 0);
    gl.uniform1i(U('tGlow'), 1);
    gl.uniform4f(U('uMap'), near.ox, near.oy, near.fit, to.glowOffset);
    gl.uniform4f(U('uSize'), to.width, to.height, to.glowWidth, to.glowHeight);
    gl.uniform2f(U('uResolution'), width, height);
    gl.uniform1f(U('uUnit'), unit);
    gl.uniform1f(U('uTime'), time);
    gl.uniform1f(U('uPresence'), presence);
    gl.uniform3f(U('uHover'), hover.x, hover.y, hover.power * Math.max(0, s.cursorIntensity));
    gl.uniform1f(U('uHoverRadius'), Math.max(1, s.cursorRadius));
    gl.uniform4fv(U('uPulses'), pulseData);
    gl.uniform1f(U('uPulseBoost'), boost);
    gl.uniform1f(U('uFlash'), flash);

    var targets = [hexToRgb(s.color), hexToRgb(s.glowColor)];
    var shift = settled ? 1 - Math.exp(-dt / 0.35) : 1;
    settled = true;
    for (var hi = 0; hi < 2; hi++) {
      for (var ci = 0; ci < 3; ci++) hues[hi][ci] += (targets[hi][ci] - hues[hi][ci]) * shift;
    }
    gl.uniform3fv(U('uColor'), hues[0]);
    gl.uniform3fv(U('uGlowColor'), hues[1]);
    gl.uniform1f(U('uIntensity'), s.intensity);
    gl.uniform1f(U('uGlow'), s.glow);
    gl.uniform1f(U('uThickness'), s.thickness);
    gl.uniform1f(U('uStrands'), Math.max(1, Math.min(6, Math.round(s.strands))));
    gl.uniform1f(U('uBend'), s.bend);
    gl.uniform1f(U('uCrackle'), s.crackle);
    gl.uniform1f(U('uFlicker'), reduceMotion ? 0 : s.flicker);
    ink += ((s.theme === 'light' ? 1 : 0) - ink) * (1 - Math.exp(-dt / 0.25));
    gl.uniform1f(U('uFill'), s.fill);
    gl.uniform1f(U('uInk'), ink);
    gl.uniform4fv(U('uArcEnds'), arcEnds);
    gl.uniform4fv(U('uArcShape'), arcShape);

    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.drawArrays(gl.TRIANGLES, 0, 3);

    if (visible) raf = requestAnimationFrame(frame);
  }

  function start() {
    if (raf || !visible) return;
    last = performance.now();
    raf = requestAnimationFrame(frame);
  }

  function onMove(e) {
    var rect = container.getBoundingClientRect();
    pointer.x = e.clientX - rect.left;
    pointer.y = e.clientY - rect.top;
    pointer.over = true;
  }
  function onDown(e) {
    onMove(e);
    if (!settings.interactive || reduceMotion) return;
    pulses.push({ x: pointer.x, y: pointer.y, born: performance.now() });
    if (pulses.length > PULSES) pulses.shift();
    burst = { x: pointer.x, y: pointer.y };
  }
  function onLeave() { pointer.over = false; }
  container.addEventListener('pointermove', onMove);
  container.addEventListener('pointerdown', onDown);
  container.addEventListener('pointerleave', onLeave);
  container.addEventListener('pointercancel', onLeave);

  var resizeObserver = new ResizeObserver(function () { resizePending = true; start(); });
  resizeObserver.observe(container);
  var intersectionObserver = new IntersectionObserver(function (entries) {
    visible = entries[0].isIntersecting;
    start();
  });
  intersectionObserver.observe(container);

  applyResize();
  start();

  // cleanup on page hide (not strictly needed)
  window.addEventListener('pagehide', function () {
    visible = false;
    if (raf) cancelAnimationFrame(raf);
    resizeObserver.disconnect();
    intersectionObserver.disconnect();
  });
})();
