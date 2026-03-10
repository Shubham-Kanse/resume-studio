"use client"

import { useEffect, useRef, useState } from "react"
import * as THREE from "three"
import { reportClientError } from "@/lib/error-monitoring"

export const BACKGROUND_THEMES = [
  { id: "current", label: "Wave" },
  { id: "aurora", label: "Aurora" },
] as const

export type BackgroundTheme = (typeof BACKGROUND_THEMES)[number]["id"]

type ThemeDefinition = {
  clearColor: number
  opacityClassName: string
  createMaterial: (size: { width: number; height: number }) => THREE.ShaderMaterial | THREE.RawShaderMaterial
  onResize?: (material: THREE.ShaderMaterial | THREE.RawShaderMaterial, width: number, height: number) => void
  onFrame?: (material: THREE.ShaderMaterial | THREE.RawShaderMaterial, deltaSeconds: number) => void
}

type SceneRefs = {
  scene: THREE.Scene | null
  camera: THREE.OrthographicCamera | null
  renderer: THREE.WebGLRenderer | null
  mesh: THREE.Mesh | null
  material: THREE.ShaderMaterial | THREE.RawShaderMaterial | null
  animationId: number | null
}

function getThemeDefinition(theme: BackgroundTheme, size: { width: number; height: number }): ThemeDefinition {
  if (theme === "aurora") {
    return {
      clearColor: 0x02040a,
      opacityClassName: "opacity-85",
      createMaterial: ({ width, height }) =>
        new THREE.ShaderMaterial({
          uniforms: {
            iTime: { value: 0 },
            iResolution: { value: new THREE.Vector2(width, height) },
          },
          vertexShader: `
            void main() {
              gl_Position = vec4(position, 1.0);
            }
          `,
          fragmentShader: `
            precision highp float;

            uniform float iTime;
            uniform vec2 iResolution;

            #define NUM_OCTAVES 3

            float rand(vec2 n) {
              return fract(sin(dot(n, vec2(12.9898, 4.1414))) * 43758.5453);
            }

            float noise(vec2 p) {
              vec2 ip = floor(p);
              vec2 u = fract(p);
              u = u * u * (3.0 - 2.0 * u);

              float res = mix(
                mix(rand(ip), rand(ip + vec2(1.0, 0.0)), u.x),
                mix(rand(ip + vec2(0.0, 1.0)), rand(ip + vec2(1.0, 1.0)), u.x),
                u.y
              );
              return res * res;
            }

            float fbm(vec2 x) {
              float v = 0.0;
              float a = 0.3;
              vec2 shift = vec2(100.0);
              mat2 rot = mat2(cos(0.5), sin(0.5), -sin(0.5), cos(0.5));
              for (int i = 0; i < NUM_OCTAVES; ++i) {
                v += a * noise(x);
                x = rot * x * 2.0 + shift;
                a *= 0.4;
              }
              return v;
            }

            void main() {
              vec2 uv = gl_FragCoord.xy / iResolution.xy;
              vec2 centeredUv = uv - 0.5;
              centeredUv.x *= iResolution.x / iResolution.y;
              vec2 shake = vec2(sin(iTime * 1.2) * 0.005, cos(iTime * 2.1) * 0.005);
              vec2 p = centeredUv + shake;
              p *= mat2(4.0, -2.6, 2.6, 4.0);

              vec2 v;
              vec4 color = vec4(0.01, 0.03, 0.08, 1.0);
              float f = 2.0 + fbm(p + vec2(iTime * 5.0, 0.0)) * 0.5;
              float wash = 0.22 + 0.18 * fbm(centeredUv * 2.2 + vec2(iTime * 0.03, -iTime * 0.02));
              color.rgb += vec3(0.02, 0.07, 0.14) * wash;
              color.rgb += vec3(0.06, 0.02, 0.12) * smoothstep(0.8, -0.2, centeredUv.y + centeredUv.x * 0.15) * 0.35;

              for (float i = 0.0; i < 35.0; i++) {
                v =
                  p +
                  cos(i * i + (iTime + p.x * 0.08) * 0.025 + i * vec2(13.0, 11.0)) * 4.2 +
                  vec2(sin(iTime * 3.0 + i) * 0.003, cos(iTime * 3.5 - i) * 0.003);
                float tailNoise = fbm(v + vec2(iTime * 0.5, i)) * 0.3 * (1.0 - (i / 35.0));
                vec4 auroraColors = vec4(
                  0.1 + 0.3 * sin(i * 0.2 + iTime * 0.4),
                  0.3 + 0.5 * cos(i * 0.3 + iTime * 0.5),
                  0.7 + 0.3 * sin(i * 0.4 + iTime * 0.3),
                  1.0
                );
                vec4 currentContribution =
                  auroraColors *
                  exp(sin(i * i + iTime * 0.8)) /
                  length(max(v, vec2(v.x * f * 0.015, v.y * 1.5)));
                float thinnessFactor = mix(0.28, 0.74, smoothstep(0.0, 1.0, i / 35.0));
                color += currentContribution * (1.0 + tailNoise * 0.8) * thinnessFactor;
              }

              float vignette = smoothstep(1.5, 0.2, length(centeredUv * vec2(0.85, 1.15)));
              color.rgb *= 0.85 + vignette * 0.35;
              color = tanh(pow(color / 100.0, vec4(1.6)));
              gl_FragColor = color * 1.5;
            }
          `,
        }),
      onResize: (material, width, height) => {
        const shader = material as THREE.ShaderMaterial
        shader.uniforms.iResolution.value.set(width, height)
      },
      onFrame: (material, deltaSeconds) => {
        const shader = material as THREE.ShaderMaterial
        shader.uniforms.iTime.value += deltaSeconds
      },
    }
  }

  return {
    clearColor: 0x000000,
    opacityClassName: "opacity-80",
    createMaterial: ({ width, height }) =>
      new THREE.RawShaderMaterial({
        vertexShader: `
          attribute vec3 position;
          void main() {
            gl_Position = vec4(position, 1.0);
          }
        `,
        fragmentShader: `
          precision highp float;
          uniform vec2 resolution;
          uniform float time;
          uniform float xScale;
          uniform float yScale;
          uniform float distortion;

          void main() {
            vec2 p = (gl_FragCoord.xy * 2.0 - resolution) / min(resolution.x, resolution.y);

            float d = length(p) * distortion;

            float rx = p.x * (1.0 + d);
            float gx = p.x;
            float bx = p.x * (1.0 - d);

            float r = 0.05 / abs(p.y + sin((rx + time) * xScale) * yScale);
            float g = 0.05 / abs(p.y + sin((gx + time) * xScale) * yScale);
            float b = 0.05 / abs(p.y + sin((bx + time) * xScale) * yScale);

            gl_FragColor = vec4(r, g, b, 1.0);
          }
        `,
        uniforms: {
          resolution: { value: new THREE.Vector2(width, height) },
          time: { value: 0 },
          xScale: { value: 1 },
          yScale: { value: 0.5 },
          distortion: { value: 0.05 },
        },
        side: THREE.DoubleSide,
      }),
    onResize: (material, width, height) => {
      const shader = material as THREE.RawShaderMaterial
      shader.uniforms.resolution.value.set(width, height)
    },
    onFrame: (material, deltaSeconds) => {
      const shader = material as THREE.RawShaderMaterial
      shader.uniforms.time.value += deltaSeconds * 0.625
    },
  }
}

export function WebGLShader({ theme = "current" }: { theme?: BackgroundTheme }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [failed, setFailed] = useState(false)
  const sceneRef = useRef<SceneRefs>({
    scene: null,
    camera: null,
    renderer: null,
    mesh: null,
    material: null,
    animationId: null,
  })

  useEffect(() => {
    setFailed(false)
  }, [theme])

  useEffect(() => {
    if (!canvasRef.current || failed) return

    const canvas = canvasRef.current
    const refs = sceneRef.current
    const themeDefinition = getThemeDefinition(theme, {
      width: window.innerWidth,
      height: window.innerHeight,
    })
    let resizeAttached = false
    let previousTime = performance.now()

    const handleResize = () => {
      if (!refs.renderer || !refs.material) return

      const width = window.innerWidth
      const height = window.innerHeight

      refs.renderer.setSize(width, height, false)
      themeDefinition.onResize?.(refs.material, width, height)
    }

    try {
      if (!("WebGLRenderingContext" in window)) {
        throw new Error("WebGL is not available in this browser")
      }

      refs.scene = new THREE.Scene()
      refs.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1)
      refs.renderer = new THREE.WebGLRenderer({
        canvas,
        antialias: theme === "aurora",
        alpha: false,
        powerPreference: "high-performance",
      })
      refs.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
      refs.renderer.setClearColor(new THREE.Color(themeDefinition.clearColor))

      const geometry = new THREE.BufferGeometry()
      geometry.setAttribute(
        "position",
        new THREE.BufferAttribute(
          new Float32Array([
            -1, -1, 0,
            1, -1, 0,
            -1, 1, 0,
            1, -1, 0,
            -1, 1, 0,
            1, 1, 0,
          ]),
          3
        )
      )

      refs.material = themeDefinition.createMaterial({
        width: window.innerWidth,
        height: window.innerHeight,
      })
      refs.mesh = new THREE.Mesh(geometry, refs.material)
      refs.scene.add(refs.mesh)

      const animate = (now: number) => {
        const deltaSeconds = Math.min(0.033, (now - previousTime) / 1000)
        previousTime = now

        if (refs.material) {
          themeDefinition.onFrame?.(refs.material, deltaSeconds)
        }

        if (refs.renderer && refs.scene && refs.camera) {
          refs.renderer.render(refs.scene, refs.camera)
        }

        refs.animationId = window.requestAnimationFrame(animate)
      }

      handleResize()
      refs.animationId = window.requestAnimationFrame(animate)
      window.addEventListener("resize", handleResize)
      resizeAttached = true
    } catch (error) {
      reportClientError(error, "webgl-shader-init")
      console.error("WebGL shader failed to initialize:", error)
      refs.renderer?.dispose()
      refs.scene = null
      refs.camera = null
      refs.renderer = null
      refs.mesh = null
      refs.material = null
      refs.animationId = null
      setFailed(true)
      return
    }

    return () => {
      if (refs.animationId !== null) {
        window.cancelAnimationFrame(refs.animationId)
      }

      if (resizeAttached) {
        window.removeEventListener("resize", handleResize)
      }

      if (refs.mesh) {
        refs.scene?.remove(refs.mesh)
        refs.mesh.geometry.dispose()
        refs.mesh.material.dispose()
      }

      refs.renderer?.dispose()
      refs.scene = null
      refs.camera = null
      refs.renderer = null
      refs.mesh = null
      refs.material = null
      refs.animationId = null
    }
  }, [failed, theme])

  if (failed) return null

  const themeDefinition = getThemeDefinition(theme, { width: 1, height: 1 })
  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className={`pointer-events-none fixed inset-0 block h-full w-full transition-opacity duration-500 ${themeDefinition.opacityClassName}`}
    />
  )
}
