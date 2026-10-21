import { useEffect, useRef } from 'react';

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

export default function Aurora({
  colorStops = ['#8b5cf6', '#ec4899', '#3b82f6'],
  amplitude = 1.0,
  speed = 0.6,
  opacity = 0.85,
  className = '',
  style
}) {
  const canvasRef = useRef(null);

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
    const uC1 = gl.getUniformLocation(program, 'uColor1');
    const uC2 = gl.getUniformLocation(program, 'uColor2');
    const uC3 = gl.getUniformLocation(program, 'uColor3');
    const uAmp = gl.getUniformLocation(program, 'uAmplitude');
    const uSpd = gl.getUniformLocation(program, 'uSpeed');
    const uPtr = gl.getUniformLocation(program, 'uPointer');
    const uOp = gl.getUniformLocation(program, 'uOpacity');

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

    window.addEventListener('mousemove', onMouseMove, { passive: true });

    let raf;
    let lastTime = performance.now();
    let clock = 0;

    const resize = () => {
      const width = canvas.parentElement?.clientWidth || window.innerWidth;
      const height = canvas.parentElement?.clientHeight || window.innerHeight;
      const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      gl.viewport(0, 0, canvas.width, canvas.height);
    };

    window.addEventListener('resize', resize, { passive: true });
    resize();

    const loop = (now) => {
      const dt = Math.min((now - lastTime) / 1000, 0.05);
      lastTime = now;
      clock += dt;

      currentMouseX += (mouseX - currentMouseX) * 0.08;
      currentMouseY += (mouseY - currentMouseY) * 0.08;

      gl.useProgram(program);
      gl.uniform2f(uRes, canvas.width, canvas.height);
      gl.uniform1f(uTime, clock);

      const c1 = parseColor(colorStops[0] || '#8b5cf6');
      const c2 = parseColor(colorStops[1] || '#ec4899');
      const c3 = parseColor(colorStops[2] || '#3b82f6');

      gl.uniform3f(uC1, c1[0], c1[1], c1[2]);
      gl.uniform3f(uC2, c2[0], c2[1], c2[2]);
      gl.uniform3f(uC3, c3[0], c3[1], c3[2]);

      gl.uniform1f(uAmp, amplitude);
      gl.uniform1f(uSpd, speed);
      gl.uniform2f(uPtr, currentMouseX, currentMouseY);
      gl.uniform1f(uOp, opacity);

      gl.enable(gl.BLEND);
      gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);

      gl.drawArrays(gl.TRIANGLES, 0, 6);

      raf = requestAnimationFrame(loop);
    };

    raf = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('resize', resize);
      gl.deleteProgram(program);
      gl.deleteShader(vs);
      gl.deleteShader(fs);
      gl.deleteBuffer(posBuffer);
    };
  }, [colorStops, amplitude, speed, opacity]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className={`pointer-events-none absolute inset-0 h-full w-full opacity-70 transition-opacity duration-1000 ${className}`}
      style={style}
    />
  );
}
