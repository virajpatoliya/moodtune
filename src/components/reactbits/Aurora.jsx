import { useEffect, useRef } from 'react';
import { REDUCED_MOTION_QUERY } from './motion.js';

const VERTEX_SHADER = `#version 300 es
in vec2 aPosition;
void main() {
  gl_Position = vec4(aPosition, 0.0, 1.0);
}`;

const FRAGMENT_SHADER = `#version 300 es
precision highp float;
precision highp int;

uniform vec2 uResolution;
uniform float uTime;
uniform vec3 uColor1;
uniform vec3 uColor2;
uniform vec3 uColor3;
uniform float uAmplitude;
uniform float uSpeed;
uniform vec2 uPointer;
uniform float uOpacity;

out vec4 outColor;

vec3 permute(vec3 x) {
  return mod(((x * 34.0) + 1.0) * x, 289.0);
}

float snoise(vec2 v) {
  const vec4 C = vec4(0.211324865405187, 0.366025403784439, -0.577350269189626, 0.024390243902439);
  vec2 i = floor(v + dot(v, C.yy));
  vec2 x0 = v - i + dot(i, C.xx);
  vec2 i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
  vec4 x12 = x0.xyxy + C.xxzz;
  x12.xy -= i1;
  i = mod(i, 289.0);
  vec3 p = permute(permute(i.y + vec3(0.0, i1.y, 1.0)) + i.x + vec3(0.0, i1.x, 1.0));
  vec3 m = max(0.5 - vec3(dot(x0, x0), dot(x12.xy, x12.xy), dot(x12.zw, x12.zw)), 0.0);
  m = m * m;
  m = m * m;
  vec3 x = 2.0 * fract(p * C.www) - 1.0;
  vec3 h = abs(x) - 0.5;
  vec3 ox = floor(x + 0.5);
  vec3 a0 = x - ox;
  m *= 1.79284291400159 - 0.85373472095314 * (a0 * a0 + h * h);
  vec3 g;
  g.x = a0.x * x0.x + h.x * x0.y;
  g.yz = a0.yz * x12.xz + h.yz * x12.yw;
  return 130.0 * dot(m, g);
}

void main() {
  vec2 uv = gl_FragCoord.xy / uResolution.xy;
  float t = uTime * uSpeed;

  // Pointer attraction
  vec2 p = uv - uPointer;
  float pDist = length(p);
  float pInfluence = exp(-pDist * 4.0) * 0.12;

  // Multi-layered waves
  float n1 = snoise(vec2(uv.x * 2.2 + t * 0.15, t * 0.12 + pInfluence));
  float n2 = snoise(vec2(uv.x * 3.8 - t * 0.22, uv.y * 1.5 + t * 0.08));
  float n3 = snoise(vec2(uv.x * 1.2 + n1 * 0.4, uv.y * 2.0 + n2 * 0.3 + t * 0.1));

  float wave = (n1 * 0.45 + n2 * 0.35 + n3 * 0.2) * uAmplitude;
  float yMask = smoothstep(0.0, 0.75, 1.0 - uv.y + wave * 0.3);

  // Gradient mixing
  float mix1 = clamp(n1 * 0.5 + 0.5, 0.0, 1.0);
  float mix2 = clamp(n2 * 0.5 + 0.5, 0.0, 1.0);

  vec3 col = mix(uColor1, uColor2, mix1);
  col = mix(col, uColor3, mix2);

  float alpha = yMask * 0.38 * uOpacity;
  outColor = vec4(col * alpha, alpha);
}`;

const parseColor = (hex) => {
  if (!hex || typeof hex !== 'string') return [0.5, 0.2, 0.9];
  const clean = hex.replace('#', '');
  if (clean.length === 3) {
    const r = parseInt(clean[0] + clean[0], 16) / 255;
    const g = parseInt(clean[1] + clean[1], 16) / 255;
    const b = parseInt(clean[2] + clean[2], 16) / 255;
    return [r, g, b];
  }
  if (clean.length >= 6) {
    const r = parseInt(clean.slice(0, 2), 16) / 255;
    const g = parseInt(clean.slice(2, 4), 16) / 255;
    const b = parseInt(clean.slice(4, 6), 16) / 255;
    return [r, g, b];
  }
  return [0.5, 0.2, 0.9];
};

// Phones and low-end machines get a lighter render: the aurora is a soft blur, so a
// lower-resolution buffer stretched by CSS looks the same and costs a fraction of the GPU.
const isConstrained = () => {
  const coarse = window.matchMedia('(pointer: coarse)').matches;
  const cores = navigator.hardwareConcurrency || 8;
  const memory = navigator.deviceMemory || 8;
  return coarse || cores <= 4 || memory <= 4;
};

export default function Aurora({
  colorStops = ['#8b5cf6', '#ec4899', '#3b82f6'],
  amplitude = 1.0,
  speed = 0.6,
  opacity = 0.85,
  className = '',
  style
}) {
  const canvasRef = useRef(null);
  // Props live in a ref so a mood change blends the colours instead of rebuilding the GL program.
  const propsRef = useRef({ colorStops, amplitude, speed, opacity });
  const wakeRef = useRef(null);

  useEffect(() => {
    propsRef.current = { colorStops, amplitude, speed, opacity };
    wakeRef.current?.();
  }, [colorStops, amplitude, speed, opacity]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const gl = canvas.getContext('webgl2', {
      alpha: true,
      antialias: false,
      depth: false,
      stencil: false,
      powerPreference: 'low-power'
    });

    // No WebGL2: the CSS radial glow behind the canvas is the fallback.
    if (!gl) return;

    const createShader = (type, source) => {
      const s = gl.createShader(type);
      gl.shaderSource(s, source);
      gl.compileShader(s);
      return s;
    };

    const vs = createShader(gl.VERTEX_SHADER, VERTEX_SHADER);
    const fs = createShader(gl.FRAGMENT_SHADER, FRAGMENT_SHADER);
    const program = gl.createProgram();
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);

    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      return;
    }

    const posBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, posBuffer);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]),
      gl.STATIC_DRAW
    );

    const aPos = gl.getAttribLocation(program, 'aPosition');
    gl.enableVertexAttribArray(aPos);
    gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

    const uRes = gl.getUniformLocation(program, 'uResolution');
    const uTime = gl.getUniformLocation(program, 'uTime');
    const uColors = [
      gl.getUniformLocation(program, 'uColor1'),
      gl.getUniformLocation(program, 'uColor2'),
      gl.getUniformLocation(program, 'uColor3')
    ];
    const uAmp = gl.getUniformLocation(program, 'uAmplitude');
    const uSpd = gl.getUniformLocation(program, 'uSpeed');
    const uPtr = gl.getUniformLocation(program, 'uPointer');
    const uOp = gl.getUniformLocation(program, 'uOpacity');

    gl.useProgram(program);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);

    const reducedQuery = window.matchMedia(REDUCED_MOTION_QUERY);
    const constrained = isConstrained();
    const renderScale = constrained ? 0.5 : 0.75;
    const frameInterval = constrained ? 1000 / 30 : 0;

    const fallback = ['#8b5cf6', '#ec4899', '#3b82f6'];
    const targetColors = () => fallback.map((c, i) => parseColor(propsRef.current.colorStops?.[i] || c));
    const colors = targetColors();

    let mouseX = 0.5;
    let mouseY = 0.5;
    let currentMouseX = 0.5;
    let currentMouseY = 0.5;

    const onMouseMove = (e) => {
      const rect = canvas.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        mouseX = (e.clientX - rect.left) / rect.width;
        mouseY = 1.0 - (e.clientY - rect.top) / rect.height;
      }
    };

    let raf = 0;
    let lastTime = 0;
    let lastDraw = 0;
    let clock = 0;

    const resize = () => {
      const width = canvas.parentElement?.clientWidth || window.innerWidth;
      const height = canvas.parentElement?.clientHeight || window.innerHeight;
      const dpr = Math.min(window.devicePixelRatio || 1, 1.5) * renderScale;
      canvas.width = Math.max(1, Math.round(width * dpr));
      canvas.height = Math.max(1, Math.round(height * dpr));
      gl.viewport(0, 0, canvas.width, canvas.height);
      draw();
    };

    // Returns true while colours are still blending toward the current mood.
    function draw() {
      const p = propsRef.current;
      const target = targetColors();
      let blending = false;
      for (let i = 0; i < 3; i++) {
        for (let k = 0; k < 3; k++) {
          const diff = target[i][k] - colors[i][k];
          if (Math.abs(diff) > 0.002) blending = true;
          colors[i][k] += diff * 0.06;
        }
        gl.uniform3f(uColors[i], colors[i][0], colors[i][1], colors[i][2]);
      }
      currentMouseX += (mouseX - currentMouseX) * 0.08;
      currentMouseY += (mouseY - currentMouseY) * 0.08;

      gl.uniform2f(uRes, canvas.width, canvas.height);
      gl.uniform1f(uTime, clock);
      gl.uniform1f(uAmp, p.amplitude);
      gl.uniform1f(uSpd, p.speed);
      gl.uniform2f(uPtr, currentMouseX, currentMouseY);
      gl.uniform1f(uOp, p.opacity);
      gl.drawArrays(gl.TRIANGLES, 0, 6);
      return blending;
    }

    const loop = (now) => {
      raf = 0;
      if (document.hidden) return;
      const reduced = reducedQuery.matches;
      if (!lastTime) lastTime = now;
      const dt = Math.min((now - lastTime) / 1000, 0.05);
      lastTime = now;
      if (!reduced) clock += dt;

      let blending = true;
      if (now - lastDraw >= frameInterval) {
        lastDraw = now;
        blending = draw();
      }
      // Reduced motion: hold a still frame, waking only to blend to a new mood's colours.
      if (!reduced || blending) raf = requestAnimationFrame(loop);
      else lastTime = 0;
    };

    const wake = () => {
      if (!raf && !document.hidden) raf = requestAnimationFrame(loop);
    };
    wakeRef.current = wake;

    const onVisibility = () => {
      if (document.hidden) {
        cancelAnimationFrame(raf);
        raf = 0;
        lastTime = 0;
      } else {
        wake();
      }
    };

    window.addEventListener('mousemove', onMouseMove, { passive: true });
    window.addEventListener('resize', resize, { passive: true });
    document.addEventListener('visibilitychange', onVisibility);
    reducedQuery.addEventListener('change', wake);
    resize();
    wake();

    return () => {
      cancelAnimationFrame(raf);
      wakeRef.current = null;
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('resize', resize);
      document.removeEventListener('visibilitychange', onVisibility);
      reducedQuery.removeEventListener('change', wake);
      gl.deleteProgram(program);
      gl.deleteShader(vs);
      gl.deleteShader(fs);
      gl.deleteBuffer(posBuffer);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className={`pointer-events-none absolute inset-0 h-full w-full opacity-70 transition-opacity duration-1000 ${className}`}
      style={style}
    />
  );
}
