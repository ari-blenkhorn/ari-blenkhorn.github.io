const canvas = document.getElementById("glory-canvas");
const unsupported = document.getElementById("unsupported");
const gl = canvas.getContext("webgl", {
  antialias: false,
  alpha: false,
  powerPreference: "high-performance",
});

const state = {
  radius: 10,
  variance: 3,
  density: 72,
  elevation: 34,
  wavelengths: 9,
  pointerX: 0,
  pointerY: 0,
  targetX: 0,
  targetY: 0,
};

const presets = {
  alpine: { radius: 10, variance: 3, density: 72, elevation: 34 },
  marine: { radius: 16, variance: 7, density: 88, elevation: 52 },
  veil: { radius: 6.5, variance: 13, density: 45, elevation: 18 },
};

if (!gl) {
  unsupported.hidden = false;
} else {
  const vertexSource = `
    attribute vec2 position;
    void main() {
      gl_Position = vec4(position, 0.0, 1.0);
    }
  `;

  const fragmentSource = `
    precision highp float;

    uniform vec2 u_resolution;
    uniform float u_time;
    uniform float u_radius;
    uniform float u_variance;
    uniform float u_density;
    uniform float u_elevation;
    uniform float u_wavelengthSamples;
    uniform vec2 u_pointer;

    float hash(vec2 p) {
      p = fract(p * vec2(123.34, 456.21));
      p += dot(p, p + 45.32);
      return fract(p.x * p.y);
    }

    float noise(vec2 p) {
      vec2 i = floor(p);
      vec2 f = fract(p);
      f = f * f * (3.0 - 2.0 * f);
      return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x),
                 mix(hash(i + vec2(0.0, 1.0)), hash(i + 1.0), f.x), f.y);
    }

    float fbm(vec2 p) {
      float value = 0.0;
      float amplitude = 0.52;
      mat2 rotation = mat2(0.80, 0.60, -0.60, 0.80);
      for (int i = 0; i < 6; i++) {
        value += amplitude * noise(p);
        p = rotation * p * 2.03 + 13.1;
        amplitude *= 0.5;
      }
      return value;
    }

    // Browser port of the fitted Mie approximation in Blenkhorn's scatter-approx.glsl.
    float mieFit(float radiusPx, float wavelength, float a, float b, float c, float d, float e, float f) {
      float axis = a * radiusPx / wavelength + b;
      float sinusoid = sin(axis) + 1.0;
      float amplitude = c * axis;
      float waveTilt = wavelength / (radiusPx + d);
      float liftTilt = e * radiusPx + f;
      return sinusoid * amplitude * waveTilt + liftTilt;
    }

    float mie0Low(float x, float wavelength) {
      return mieFit(x, wavelength, 19.21, -1.34368, 1.90862, -9.00753, -0.307148, 35.2949);
    }

    float mie0High(float x, float wavelength) {
      return mieFit(x, wavelength, 40.8859, -5.88436, 0.701986, -47.3567, -0.105205, 26.4019);
    }

    float mie1(float x, float wavelength) {
      return mieFit(x, wavelength, -32.4674, 0.285757, -0.26865, -62.4836, -0.0423437, 17.1591);
    }

    float mie2(float x, float wavelength) {
      return mieFit(x, wavelength, 32.731, -2.61779, 0.24609, -84.7096, -0.0281039, 17.063);
    }

    float mie3(float x, float wavelength) {
      return mieFit(x, wavelength, -31.8108, 1.13739, 0.181815, -114.713, -0.0521497, 44.494);
    }

    float mie4(float x, float wavelength) {
      return mieFit(x, wavelength, 31.1967, -15.3794, -0.201447, -216.599, -0.0599048, 47.6297);
    }

    float approximateMie(float fitPixel, float wavelength, float dropletRadius) {
      float x = fitPixel * dropletRadius / 10.0;
      float cut0 = 0.264705882 * wavelength - 20.5882;
      float cut01 = 0.2617647 * wavelength + 2.529411764;
      float cut12 = 0.4147059 * wavelength + 7.411764706;
      float cut23 = 0.5583333 * wavelength + 15.8333333333;
      float cut34 = 0.73 * wavelength + 11.6;
      float blend = 0.05;
      float delta0 = cut01 - cut0;
      float delta1 = cut12 - cut01;
      float delta2 = cut23 - cut12;
      float delta3 = cut34 - cut23;
      float low00 = (1.0 - blend) * cut0;
      float high00 = cut0 + blend * delta0;
      float low0 = cut01 - blend * delta0;
      float high0 = cut01 + blend * delta1;
      float low1 = cut12 - blend * delta1;
      float high1 = cut12 + blend * delta2;
      float low2 = cut23 - blend * delta2;
      float high2 = cut23 + blend * delta3;
      float low3 = cut34 - blend * delta3;
      float high3 = (1.0 + blend) * cut34;
      float value;

      if (x < low00) {
        value = mie0Low(x, wavelength);
      } else if (x < high00) {
        value = mix(mie0Low(x, wavelength), mie0High(x, wavelength), (x - low00) / (high00 - low00));
      } else if (x < low0) {
        value = mie0High(x, wavelength);
      } else if (x < high0) {
        value = mix(mie0High(x, wavelength), mie1(x, wavelength), (x - low0) / (high0 - low0));
      } else if (x < low1) {
        value = mie1(x, wavelength);
      } else if (x < high1) {
        value = mix(mie1(x, wavelength), mie2(x, wavelength), (x - low1) / (high1 - low1));
      } else if (x < low2) {
        value = mie2(x, wavelength);
      } else if (x < high2) {
        value = mix(mie2(x, wavelength), mie3(x, wavelength), (x - low2) / (high2 - low2));
      } else if (x < low3) {
        value = mie3(x, wavelength);
      } else if (x < high3) {
        value = mix(mie3(x, wavelength), mie4(x, wavelength), (x - low3) / (high3 - low3));
      } else {
        value = mie4(x, wavelength);
      }

      return max(value, 0.0);
    }

    vec3 cie1931(float wavelength) {
      float x1 = (wavelength - 442.0) * (wavelength < 442.0 ? 0.0624 : 0.0374);
      float x2 = (wavelength - 599.8) * (wavelength < 599.8 ? 0.0264 : 0.0323);
      float x3 = (wavelength - 501.1) * (wavelength < 501.1 ? 0.0490 : 0.0382);
      float xBar = 0.362 * exp(-0.5 * x1 * x1) + 1.056 * exp(-0.5 * x2 * x2) - 0.065 * exp(-0.5 * x3 * x3);

      float y1 = (wavelength - 568.8) * (wavelength < 568.8 ? 0.0213 : 0.0247);
      float y2 = (wavelength - 530.9) * (wavelength < 530.9 ? 0.0613 : 0.0322);
      float yBar = 0.821 * exp(-0.5 * y1 * y1) + 0.286 * exp(-0.5 * y2 * y2);

      float z1 = (wavelength - 437.0) * (wavelength < 437.0 ? 0.0845 : 0.0278);
      float z2 = (wavelength - 459.0) * (wavelength < 459.0 ? 0.0385 : 0.0725);
      float zBar = 1.217 * exp(-0.5 * z1 * z1) + 0.681 * exp(-0.5 * z2 * z2);
      return vec3(xBar, yBar, zBar);
    }

    vec3 xyzToLinearRgb(vec3 xyz) {
      return vec3(
        3.240479 * xyz.x - 1.537150 * xyz.y - 0.498535 * xyz.z,
        -0.969256 * xyz.x + 1.875992 * xyz.y + 0.041556 * xyz.z,
        0.055648 * xyz.x - 0.204043 * xyz.y + 1.057311 * xyz.z
      );
    }

    float solarWeight(float wavelength) {
      float temperatureConstant = 2489.0;
      float reference = exp(temperatureConstant / 550.0) - 1.0;
      float ratio = 550.0 / wavelength;
      return pow(ratio, 5.0) * reference / (exp(temperatureConstant / wavelength) - 1.0);
    }

    float radiusSample(float meanRadius, float coefficient, float z) {
      return max(2.0, meanRadius * (1.0 + coefficient * z));
    }

    float distributedMie(float fitPixel, float wavelength, float meanRadius, float coefficient) {
      float value = 0.0;
      value += approximateMie(fitPixel, wavelength, radiusSample(meanRadius, coefficient, -2.0)) * 0.06136;
      value += approximateMie(fitPixel, wavelength, radiusSample(meanRadius, coefficient, -1.0)) * 0.24477;
      value += approximateMie(fitPixel, wavelength, meanRadius) * 0.38774;
      value += approximateMie(fitPixel, wavelength, radiusSample(meanRadius, coefficient, 1.0)) * 0.24477;
      value += approximateMie(fitPixel, wavelength, radiusSample(meanRadius, coefficient, 2.0)) * 0.06136;
      return value;
    }

    vec3 spectralGlory(float angularOffset, float meanRadius, float coefficient, float wavelengthSamples) {
      float angularDegrees = angularOffset * 11.0;
      float fitPixel = angularDegrees * 56.75;
      vec3 xyz = vec3(0.0);

      for (int sampleIndex = 0; sampleIndex < 100; sampleIndex++) {
        if (float(sampleIndex) < wavelengthSamples) {
          float wavelength = 400.0 + (float(sampleIndex) + 0.5) * (300.0 / wavelengthSamples);
          float intensity = distributedMie(fitPixel, wavelength, meanRadius, coefficient);
          xyz += intensity * cie1931(wavelength) * solarWeight(wavelength);
        }
      }

      xyz *= 9.0 / wavelengthSamples;
      vec3 rgb = max(xyzToLinearRgb(xyz) * 0.0045, 0.0);
      rgb = rgb / (1.0 + rgb * 0.58);
      rgb *= 1.0 - smoothstep(5.2, 6.3, angularDegrees);
      float core = 1.0 - smoothstep(0.22, 0.46, angularDegrees);
      rgb = mix(rgb, vec3(0.58), core);
      return rgb;
    }

    void main() {
      vec2 uv = gl_FragCoord.xy / u_resolution.xy;
      vec2 centered = uv - 0.5;
      centered.x *= u_resolution.x / u_resolution.y;

      float drift = u_time * 0.012;
      vec2 cloudUv = vec2(uv.x * 2.1, uv.y * 1.55);
      float broad = fbm(cloudUv * 1.35 + vec2(drift, -drift * 0.3));
      float detail = fbm(cloudUv * 4.5 - vec2(drift * 1.7, drift));
      float wisps = fbm(vec2(cloudUv.x * 1.1 + broad, cloudUv.y * 2.0 - drift));
      float cloud = broad * 0.70 + detail * 0.20 + wisps * 0.10;
      cloud = smoothstep(0.25, 0.82, cloud + u_density * 0.16);

      float horizon = smoothstep(0.0, 0.72, uv.y);
      vec3 shadowTone = vec3(0.15, 0.20, 0.20);
      vec3 lightTone = vec3(0.67, 0.72, 0.70);
      vec3 cloudColor = mix(shadowTone, lightTone, cloud * 0.86 + horizon * 0.12);

      vec2 center = vec2(
        0.06 + u_pointer.x * 0.022,
        -0.035 + u_pointer.y * 0.018 + (u_elevation - 0.5) * 0.08
      );
      vec2 delta = centered - center;
      float angle = length(delta);
      float meanRadius = mix(4.0, 22.0, u_radius);
      float radiusCoefficient = u_variance * 0.20;
      vec3 glory = spectralGlory(angle, meanRadius, radiusCoefficient, u_wavelengthSamples);

      float cloudMask = smoothstep(0.20, 0.72, cloud) * (0.72 + 0.28 * detail);
      float shadow = exp(-pow(length((delta - vec2(0.0, -0.015)) * vec2(1.0, 1.3)) / 0.055, 2.0));
      cloudColor *= 1.0 - shadow * 0.36;
      cloudColor += glory * cloudMask * mix(0.52, 1.15, u_density);


      float vignette = 1.0 - dot(uv - 0.5, uv - 0.5) * 0.48;
      cloudColor *= vignette;
      cloudColor += (hash(gl_FragCoord.xy + u_time) - 0.5) * 0.018;
      cloudColor = pow(max(cloudColor, 0.0), vec3(0.92));

      gl_FragColor = vec4(cloudColor, 1.0);
    }
  `;

  const compileShader = (type, source) => {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      throw new Error(gl.getShaderInfoLog(shader));
    }
    return shader;
  };

  const program = gl.createProgram();
  gl.attachShader(program, compileShader(gl.VERTEX_SHADER, vertexSource));
  gl.attachShader(program, compileShader(gl.FRAGMENT_SHADER, fragmentSource));
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    throw new Error(gl.getProgramInfoLog(program));
  }

  const vertices = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, vertices);
  gl.bufferData(
    gl.ARRAY_BUFFER,
    new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]),
    gl.STATIC_DRAW,
  );

  gl.useProgram(program);
  const position = gl.getAttribLocation(program, "position");
  gl.enableVertexAttribArray(position);
  gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);

  const uniforms = {
    resolution: gl.getUniformLocation(program, "u_resolution"),
    time: gl.getUniformLocation(program, "u_time"),
    radius: gl.getUniformLocation(program, "u_radius"),
    variance: gl.getUniformLocation(program, "u_variance"),
    density: gl.getUniformLocation(program, "u_density"),
    elevation: gl.getUniformLocation(program, "u_elevation"),
    wavelengthSamples: gl.getUniformLocation(program, "u_wavelengthSamples"),
    pointer: gl.getUniformLocation(program, "u_pointer"),
  };

  const resize = () => {
    const pixelRatio = Math.min(window.devicePixelRatio, 1.75);
    const width = Math.floor(canvas.clientWidth * pixelRatio);
    const height = Math.floor(canvas.clientHeight * pixelRatio);
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
      gl.viewport(0, 0, width, height);
    }
  };

  const startTime = performance.now();
  const render = (now) => {
    resize();
    state.pointerX += (state.targetX - state.pointerX) * 0.035;
    state.pointerY += (state.targetY - state.pointerY) * 0.035;

    gl.uniform2f(uniforms.resolution, canvas.width, canvas.height);
    gl.uniform1f(uniforms.time, (now - startTime) / 1000);
    gl.uniform1f(uniforms.radius, (state.radius - 4) / 18);
    gl.uniform1f(uniforms.variance, state.variance / 20);
    gl.uniform1f(uniforms.density, (state.density - 25) / 75);
    gl.uniform1f(uniforms.elevation, (state.elevation - 5) / 75);
    gl.uniform1f(uniforms.wavelengthSamples, state.wavelengths);
    gl.uniform2f(uniforms.pointer, state.pointerX, state.pointerY);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
    requestAnimationFrame(render);
  };

  window.addEventListener("pointermove", (event) => {
    state.targetX = event.clientX / window.innerWidth - 0.5;
    state.targetY = 0.5 - event.clientY / window.innerHeight;
  });

  requestAnimationFrame(render);
}

const inputs = {
  radius: document.getElementById("radius"),
  variance: document.getElementById("variance"),
  density: document.getElementById("density"),
  elevation: document.getElementById("elevation"),
  wavelengths: document.getElementById("wavelengths"),
};

const outputs = {
  radius: document.getElementById("radius-output"),
  variance: document.getElementById("variance-output"),
  density: document.getElementById("density-output"),
  elevation: document.getElementById("elevation-output"),
  wavelengths: document.getElementById("wavelengths-output"),
};

const updateRangeFill = (input) => {
  const fraction = ((input.value - input.min) / (input.max - input.min)) * 100;
  input.style.setProperty("--progress", `${fraction}%`);
};

const updateReadout = () => {
  outputs.radius.value = state.radius.toFixed(1);
  outputs.variance.value = state.variance.toFixed(1);
  outputs.density.value = Math.round(state.density);
  outputs.elevation.value = Math.round(state.elevation);
  outputs.wavelengths.value = Math.round(state.wavelengths);
  document.getElementById("ring-output").textContent = `${(21 / state.radius).toFixed(1)}°`;
  const coherence = state.variance < 5 ? "HIGH" : state.variance < 12 ? "MEDIUM" : "LOW";
  document.getElementById("coherence-output").textContent = coherence;
};

Object.entries(inputs).forEach(([key, input]) => {
  updateRangeFill(input);
  input.addEventListener("input", () => {
    state[key] = Number(input.value);
    updateRangeFill(input);
    updateReadout();
    if (key !== "wavelengths") {
      document.querySelectorAll(".preset").forEach((button) => button.classList.remove("active"));
    }
  });
});

document.querySelectorAll(".preset").forEach((button) => {
  button.addEventListener("click", () => {
    const settings = presets[button.dataset.preset];
    Object.assign(state, settings);
    Object.entries(settings).forEach(([key, value]) => {
      const input = inputs[key];
      input.value = value;
      updateRangeFill(input);
    });
    updateReadout();
    document.querySelectorAll(".preset").forEach((item) => item.classList.remove("active"));
    button.classList.add("active");
  });
});

const scienceCard = document.getElementById("science-card");
const setInfoOpen = (open) => {
  scienceCard.classList.toggle("open", open);
  scienceCard.setAttribute("aria-hidden", String(!open));
};

document.getElementById("info-button").addEventListener("click", () => setInfoOpen(true));
/*
document.getElementById("explore-button").addEventListener("click", () => {
  inputs.radius.focus();
  document.querySelector(".control-panel").animate(
    [
      { borderColor: "rgba(255,255,255,.18)" },
      { borderColor: "rgba(162,230,220,.72)" },
      { borderColor: "rgba(255,255,255,.18)" },
    ],
    { duration: 800, easing: "ease-out" },
  );
});
*/
document.getElementById("close-info").addEventListener("click", () => setInfoOpen(false));
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") setInfoOpen(false);
});

updateReadout();
