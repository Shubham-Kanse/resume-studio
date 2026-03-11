"use client"

import { memo, useEffect, useRef, useState } from "react"

import * as THREE from "three"

import { type BackgroundTheme } from "@/features/workspace/background-themes"
import { reportClientError } from "@/lib/error-monitoring"

type ShaderUniform = {
  value: unknown
}

type ShaderLikeMaterial = {
  uniforms: Record<string, ShaderUniform>
  dispose: () => void
}

type WaveMaterial = ShaderLikeMaterial & {
  uniforms: ShaderLikeMaterial["uniforms"] & {
    time: { value: number }
    resolution: { value: { set: (width: number, height: number) => void } }
  }
}

type AuroraMaterial = ShaderLikeMaterial & {
  uniforms: ShaderLikeMaterial["uniforms"] & {
    time: { value: number }
    resolution: { value: { set: (width: number, height: number) => void } }
  }
}

type SceneLike = {
  add: (mesh: MeshLike) => void
  remove: (mesh: MeshLike) => void
}

type RendererLike = {
  setSize: (width: number, height: number, updateStyle?: boolean) => void
  setPixelRatio: (value: number) => void
  setClearColor: (color: unknown) => void
  render: (scene: SceneLike, camera: object) => void
  dispose: () => void
}

type MeshLike = {
  geometry: { dispose: () => void }
  material: { dispose: () => void }
}

type ThemeDefinition = {
  clearColor: number
  opacityClassName: string
  createMaterial: (size: {
    width: number
    height: number
  }) => ShaderLikeMaterial
  onResize?: (
    material: ShaderLikeMaterial,
    width: number,
    height: number
  ) => void
  onFrame?: (material: ShaderLikeMaterial, deltaSeconds: number) => void
}

type SceneRefs = {
  scene: SceneLike | null
  camera: object | null
  renderer: RendererLike | null
  mesh: MeshLike | null
  material: ShaderLikeMaterial | null
  animationId: number | null
}

function getThemeDefinition(
  theme: BackgroundTheme,
  _size: { width: number; height: number }
): ThemeDefinition {
  if (theme === "aurora") {
    return {
      clearColor: 0x000000,
      opacityClassName: "opacity-75",
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

            float hash(vec2 p) {
              return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
            }

            float noise(vec2 p) {
              vec2 i = floor(p);
              vec2 f = fract(p);
              vec2 u = f * f * (3.0 - 2.0 * f);

              return mix(
                mix(hash(i + vec2(0.0, 0.0)), hash(i + vec2(1.0, 0.0)), u.x),
                mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x),
                u.y
              );
            }

            float fbm(vec2 p) {
              float value = 0.0;
              float amplitude = 0.5;

              value += amplitude * noise(p);
              p = p * 2.02 + vec2(7.1, 3.4);
              amplitude *= 0.5;

              value += amplitude * noise(p);
              p = p * 2.03 + vec2(2.7, 9.2);
              amplitude *= 0.5;

              value += amplitude * noise(p);
              return value;
            }

            void main() {
              vec2 uv = gl_FragCoord.xy / resolution.xy;
              vec2 p = uv - 0.5;
              p.x *= resolution.x / resolution.y;

              float drift = time * 0.065;
              float band = sin(p.x * 4.4 + fbm(vec2(p.x * 1.35 + drift, p.y * 1.8)) * 2.6 + time * 0.22);
              float ribbon = smoothstep(0.9, -0.45, abs(p.y - band * 0.24));

              float veilA = fbm(vec2(p.x * 1.8 - drift * 1.2, p.y * 2.5 + drift * 0.5));
              float veilB = fbm(vec2(p.x * 2.4 + drift * 0.7, p.y * 1.7 - drift * 0.35));
              float veil = ribbon * (0.6 + veilA * 0.7 + veilB * 0.35);

              vec3 colorA = vec3(0.08, 0.72, 0.54);
              vec3 colorB = vec3(0.18, 0.42, 0.95);
              vec3 colorC = vec3(0.48, 0.20, 0.88);

              float mixAB = smoothstep(-0.3, 0.75, p.x + veilA * 0.25);
              float mixBC = smoothstep(-0.35, 0.8, p.y + veilB * 0.18);
              vec3 color = mix(colorA, colorB, mixAB);
              color = mix(color, colorC, mixBC * 0.38);

              float glow = exp(-6.5 * abs(p.y - band * 0.2));
              float vignette = smoothstep(1.25, 0.15, length(p));
              vec3 finalColor = color * veil * glow * vignette;

              gl_FragColor = vec4(finalColor, 1.0);
            }
          `,
          uniforms: {
            resolution: { value: new THREE.Vector2(width, height) },
            time: { value: 0 },
          },
          side: THREE.DoubleSide,
        }) as AuroraMaterial,
      onResize: (material, width, height) => {
        ;(material as AuroraMaterial).uniforms.resolution.value.set(
          width,
          height
        )
      },
      onFrame: (material, deltaSeconds) => {
        ;(material as AuroraMaterial).uniforms.time.value += deltaSeconds
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
      }) as WaveMaterial,
    onResize: (material, width, height) => {
      ;(material as WaveMaterial).uniforms.resolution.value.set(width, height)
    },
    onFrame: (material, deltaSeconds) => {
      ;(material as WaveMaterial).uniforms.time.value += deltaSeconds * 0.625
    },
  }
}

function WebGLShaderComponent({
  theme = "aurora",
}: {
  theme?: BackgroundTheme
}) {
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
    let visibilityAttached = false
    let previousTime = performance.now()
    let lastRenderTime = 0
    let animationRunning = false
    const maxPixelRatio = 1.35
    const frameIntervalMs = 1000 / 30

    const handleResize = () => {
      if (!refs.renderer || !refs.material) return

      const width = window.innerWidth
      const height = window.innerHeight

      refs.renderer.setSize(width, height, false)
      refs.renderer.setPixelRatio(
        Math.min(window.devicePixelRatio, maxPixelRatio)
      )
      themeDefinition.onResize?.(refs.material, width, height)
    }

    const stopAnimation = () => {
      animationRunning = false
      if (refs.animationId !== null) {
        window.cancelAnimationFrame(refs.animationId)
        refs.animationId = null
      }
    }

    const handleVisibilityChange = () => {
      if (document.hidden) {
        stopAnimation()
        return
      }

      if (animationRunning) return
      previousTime = performance.now()
      lastRenderTime = 0
      animationRunning = true
      refs.animationId = window.requestAnimationFrame(animate)
    }

    function animate(now: number) {
      if (!animationRunning) return

      refs.animationId = window.requestAnimationFrame(animate)
      if (now - lastRenderTime < frameIntervalMs) return

      const deltaSeconds = Math.min(0.033, (now - previousTime) / 1000)
      previousTime = now
      lastRenderTime = now

      if (refs.material) {
        themeDefinition.onFrame?.(refs.material, deltaSeconds)
      }

      if (refs.renderer && refs.scene && refs.camera) {
        refs.renderer.render(refs.scene, refs.camera)
      }
    }

    const startAnimation = () => {
      if (animationRunning) return
      animationRunning = true
      previousTime = performance.now()
      lastRenderTime = 0
      refs.animationId = window.requestAnimationFrame(animate)
    }

    try {
      if (!("WebGLRenderingContext" in window)) {
        throw new Error("WebGL is not available in this browser")
      }

      const scene = new THREE.Scene() as SceneLike
      const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1)
      const renderer = new THREE.WebGLRenderer({
        canvas,
        antialias: false,
        alpha: false,
        powerPreference: "high-performance",
      }) as RendererLike
      refs.scene = scene
      refs.camera = camera
      refs.renderer = renderer
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, maxPixelRatio))
      renderer.setClearColor(new THREE.Color(themeDefinition.clearColor))

      const geometry = new THREE.BufferGeometry()
      geometry.setAttribute(
        "position",
        new THREE.BufferAttribute(
          new Float32Array([
            -1, -1, 0, 1, -1, 0, -1, 1, 0, 1, -1, 0, -1, 1, 0, 1, 1, 0,
          ]),
          3
        )
      )

      refs.material = themeDefinition.createMaterial({
        width: window.innerWidth,
        height: window.innerHeight,
      })
      const mesh = new THREE.Mesh(geometry, refs.material) as MeshLike
      refs.mesh = mesh
      scene.add(mesh)

      handleResize()
      startAnimation()
      window.addEventListener("resize", handleResize)
      document.addEventListener("visibilitychange", handleVisibilityChange)
      resizeAttached = true
      visibilityAttached = true
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
      stopAnimation()

      if (resizeAttached) {
        window.removeEventListener("resize", handleResize)
      }

      if (visibilityAttached) {
        document.removeEventListener("visibilitychange", handleVisibilityChange)
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
      className={`pointer-events-none fixed inset-0 block h-full w-full blur-[7px] transition-opacity duration-500 ${themeDefinition.opacityClassName}`}
    />
  )
}

export const WebGLShader = memo(WebGLShaderComponent)
