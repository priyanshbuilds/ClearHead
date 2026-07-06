"use client";

import React, { useEffect, useRef } from "react";
import * as THREE from "three";

interface NeuralBrandBackgroundProps {
  word?: string;
  fillerNodeCount?: number;
  connectionDistance?: number;
  primaryColor?: string;
  secondaryColor?: string;
  className?: string;
}

function createLetterTexture(letter: string, color: string): THREE.Texture {
  const size = 256;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  ctx.clearRect(0, 0, size, size);

  const glow = ctx.createRadialGradient(
    size / 2, size / 2, 0, size / 2, size / 2, size / 2
  );
  glow.addColorStop(0, color + "55");
  glow.addColorStop(1, color + "00");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, size, size);

  ctx.font = "bold 160px 'Plus Jakarta Sans', sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = "#FFFFFF";
  ctx.shadowColor = color;
  ctx.shadowBlur = 30;
  ctx.fillText(letter, size / 2, size / 2 + 10);

  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;
  return texture;
}

function createGlowTexture(): THREE.Texture {
  const size = 128;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  const gradient = ctx.createRadialGradient(
    size / 2, size / 2, 0, size / 2, size / 2, size / 2
  );
  gradient.addColorStop(0, "rgba(255,255,255,0.95)");
  gradient.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);
  return new THREE.CanvasTexture(canvas);
}

// Easing for smooth assemble/scatter transitions
function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

function randomScatterPosition(): THREE.Vector3 {
  return new THREE.Vector3(
    (Math.random() - 0.5) * 18,
    (Math.random() - 0.5) * 11,
    (Math.random() - 0.5) * 9
  );
}

export const NeuralBrandBackground = ({
  word = "CLEARHEAD",
  fillerNodeCount = 38,
  connectionDistance = 5.5,
  primaryColor = "#7B6EF6",
  secondaryColor = "#2DD4BF",
  className,
}: NeuralBrandBackgroundProps) => {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const width = container.clientWidth;
    const height = container.clientHeight;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(60, width / height, 0.1, 1000);
    camera.position.z = 15;

    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    container.appendChild(renderer.domElement);

    const colorA = new THREE.Color(primaryColor);
    const colorB = new THREE.Color(secondaryColor);
    const glowTexture = createGlowTexture();

    type NodeData = {
      mesh: THREE.Object3D;
      velocity: THREE.Vector3;
      pulsePhase: number;
      isLetter: boolean;
    };
    const nodes: NodeData[] = [];

    // ── Letters: build with formation + scatter targets ──
    type LetterState = {
      sprite: THREE.Sprite;
      scatterFrom: THREE.Vector3;
      scatterTo: THREE.Vector3;
      formedPos: THREE.Vector3;
      scatterRotFrom: number;
      scatterRotTo: number;
      formedRot: number;
      velocity: THREE.Vector3;
      pulsePhase: number;
    };
    const letterStates: LetterState[] = [];

    const orientations = [0, 90, 180, 270, 45, -45, 135, -135];
    const letters = word.split("");

    // Three possible "formed" layouts: horizontal, vertical, diagonal line
    function computeFormedLayout(variant: number) {
      const spacing = 1.55;
      const totalWidth = (letters.length - 1) * spacing;
      return letters.map((_, i) => {
        const offset = i * spacing - totalWidth / 2;
        if (variant === 0) {
          // horizontal
          return { pos: new THREE.Vector3(offset, 0, 0), rot: 0 };
        } else if (variant === 1) {
          // vertical
          return { pos: new THREE.Vector3(0, -offset, 0), rot: 90 };
        } else {
          // diagonal
          return {
            pos: new THREE.Vector3(offset * 0.75, -offset * 0.55, 0),
            rot: 45,
          };
        }
      });
    }

    let currentFormationVariant = 0;
    let formedLayout = computeFormedLayout(currentFormationVariant);

    letters.forEach((letter, i) => {
      const mixRatio = i / letters.length;
      const color = colorA.clone().lerp(colorB, mixRatio);
      const texture = createLetterTexture(letter, "#" + color.getHexString());

      const material = new THREE.SpriteMaterial({
        map: texture,
        transparent: true,
        opacity: 0.95,
        depthWrite: false,
      });

      const sprite = new THREE.Sprite(material);
      sprite.scale.set(1.6, 1.6, 1.6);

      const startPos = randomScatterPosition();
      sprite.position.copy(startPos);
      scene.add(sprite);

      const rotDeg = orientations[Math.floor(Math.random() * orientations.length)];
      sprite.material.rotation = (rotDeg * Math.PI) / 180;

      letterStates.push({
        sprite,
        scatterFrom: startPos.clone(),
        scatterTo: randomScatterPosition(),
        formedPos: formedLayout[i].pos.clone(),
        scatterRotFrom: rotDeg,
        scatterRotTo: orientations[Math.floor(Math.random() * orientations.length)],
        formedRot: formedLayout[i].rot,
        velocity: new THREE.Vector3(),
        pulsePhase: Math.random() * Math.PI * 2,
      });

      nodes.push({
        mesh: sprite,
        velocity: new THREE.Vector3(),
        pulsePhase: Math.random() * Math.PI * 2,
        isLetter: true,
      });
    });

    // ── Filler neuron nodes ──
    const nodeGeometry = new THREE.SphereGeometry(0.05, 10, 10);
    for (let i = 0; i < fillerNodeCount; i++) {
      const mixRatio = Math.random();
      const color = colorA.clone().lerp(colorB, mixRatio);
      const material = new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity: 0.7,
      });
      const mesh = new THREE.Mesh(nodeGeometry, material);
      mesh.position.set(
        (Math.random() - 0.5) * 20,
        (Math.random() - 0.5) * 13,
        (Math.random() - 0.5) * 8
      );
      scene.add(mesh);

      const spriteMat = new THREE.SpriteMaterial({
        map: glowTexture,
        color,
        transparent: true,
        opacity: 0.3,
        depthWrite: false,
      });
      const glowSprite = new THREE.Sprite(spriteMat);
      glowSprite.scale.set(0.5, 0.5, 0.5);
      mesh.add(glowSprite);

      // 2x filler drift speed
      nodes.push({
        mesh,
        velocity: new THREE.Vector3(
          (Math.random() - 0.5) * 0.01,
          (Math.random() - 0.5) * 0.01,
          (Math.random() - 0.5) * 0.01
        ),
        pulsePhase: Math.random() * Math.PI * 2,
        isLetter: false,
      });
    }

    // ── Synapse connections ──
    const maxConnections = nodes.length * 5;
    const linePositions = new Float32Array(maxConnections * 2 * 3);
    const lineColors = new Float32Array(maxConnections * 2 * 3);
    const lineGeometry = new THREE.BufferGeometry();
    lineGeometry.setAttribute("position", new THREE.BufferAttribute(linePositions, 3));
    lineGeometry.setAttribute("color", new THREE.BufferAttribute(lineColors, 3));
    const lineMaterial = new THREE.LineBasicMaterial({
      vertexColors: true,
      transparent: true,
      opacity: 0.16,
    });
    const lines = new THREE.LineSegments(lineGeometry, lineMaterial);
    scene.add(lines);

    // ── Traveling electrical pulses (2x speed) ──
    const PULSE_POOL_SIZE = 30;
    type Pulse = {
      sprite: THREE.Sprite;
      from: THREE.Vector3;
      to: THREE.Vector3;
      progress: number;
      speed: number;
      active: boolean;
    };
    const pulseTexture = createGlowTexture();
    const pulses: Pulse[] = [];
    for (let i = 0; i < PULSE_POOL_SIZE; i++) {
      const mat = new THREE.SpriteMaterial({
        map: pulseTexture,
        color: colorB,
        transparent: true,
        opacity: 0,
        depthWrite: false,
      });
      const sprite = new THREE.Sprite(mat);
      sprite.scale.set(0.28, 0.28, 0.28);
      scene.add(sprite);
      pulses.push({
        sprite,
        from: new THREE.Vector3(),
        to: new THREE.Vector3(),
        progress: 0,
        speed: 0,
        active: false,
      });
    }

    let activeConnectionPairs: [THREE.Vector3, THREE.Vector3][] = [];

    const spawnPulse = () => {
      if (activeConnectionPairs.length === 0) return;
      const free = pulses.find((p) => !p.active);
      if (!free) return;
      const pair =
        activeConnectionPairs[Math.floor(Math.random() * activeConnectionPairs.length)];
      free.from.copy(pair[0]);
      free.to.copy(pair[1]);
      free.progress = 0;
      // 2x pulse travel speed
      free.speed = 0.024 + Math.random() * 0.03;
      free.active = true;
      (free.sprite.material as THREE.SpriteMaterial).opacity = 0.9;
    };

    // ── Letter formation cycle timing ──
    // 0s-5s: scattered drifting | 5s-7.5s: assembling | 7.5s-12s: formed hold
    // 12s-14.5s: scattering out | repeat with new random targets + new variant
    const CYCLE = {
      scatterDuration: 3,
      assembleDuration: 1.5,
      holdDuration: 3.5,
      disperseDuration: 1.5,
    };
    const CYCLE_TOTAL =
      CYCLE.scatterDuration +
      CYCLE.assembleDuration +
      CYCLE.holdDuration +
      CYCLE.disperseDuration;

    let cycleTime = 0;
    let cycleStage: "scatter" | "assemble" | "hold" | "disperse" = "scatter";

    const regenerateScatterTargets = () => {
      letterStates.forEach((l) => {
        l.scatterFrom.copy(l.sprite.position);
        l.scatterTo.copy(randomScatterPosition());
        l.scatterRotFrom = l.scatterRotTo;
        l.scatterRotTo =
          orientations[Math.floor(Math.random() * orientations.length)];
      });
    };

    const regenerateFormation = () => {
      currentFormationVariant = (currentFormationVariant + 1) % 3;
      formedLayout = computeFormedLayout(currentFormationVariant);
      letterStates.forEach((l, i) => {
        l.formedPos.copy(formedLayout[i].pos);
        l.formedRot = formedLayout[i].rot;
      });
    };

    let frameId: number;
    const clock = new THREE.Clock();
    let pulseSpawnTimer = 0;

    const animate = () => {
      const elapsed = clock.getElapsedTime();
      const delta = clock.getDelta();

      // ── Filler node drift ──
      nodes.forEach(({ mesh, velocity, pulsePhase, isLetter }) => {
        if (isLetter) return;
        mesh.position.add(velocity);
        if (Math.abs(mesh.position.x) > 10) velocity.x *= -1;
        if (Math.abs(mesh.position.y) > 6.5) velocity.y *= -1;
        if (Math.abs(mesh.position.z) > 5) velocity.z *= -1;
        const pulse = 0.85 + Math.sin(elapsed * 3 + pulsePhase) * 0.15;
        mesh.scale.setScalar(pulse);
      });

      // ── Letter formation cycle ──
      cycleTime += delta;
      if (cycleTime > CYCLE_TOTAL) {
        cycleTime = 0;
        regenerateScatterTargets();
        regenerateFormation();
      }

      if (cycleTime < CYCLE.scatterDuration) {
        cycleStage = "scatter";
        const t = easeInOutCubic(cycleTime / CYCLE.scatterDuration);
        letterStates.forEach((l) => {
          l.sprite.position.lerpVectors(l.scatterFrom, l.scatterTo, t);
          const rot =
            l.scatterRotFrom + (l.scatterRotTo - l.scatterRotFrom) * t;
          l.sprite.material.rotation = (rot * Math.PI) / 180;
        });
      } else if (cycleTime < CYCLE.scatterDuration + CYCLE.assembleDuration) {
        cycleStage = "assemble";
        const t = easeInOutCubic(
          (cycleTime - CYCLE.scatterDuration) / CYCLE.assembleDuration
        );
        letterStates.forEach((l) => {
          l.sprite.position.lerpVectors(l.scatterTo, l.formedPos, t);
          const rot = l.scatterRotTo + (l.formedRot - l.scatterRotTo) * t;
          l.sprite.material.rotation = (rot * Math.PI) / 180;
        });
      } else if (
        cycleTime <
        CYCLE.scatterDuration + CYCLE.assembleDuration + CYCLE.holdDuration
      ) {
        cycleStage = "hold";
        letterStates.forEach((l) => {
          l.sprite.position.copy(l.formedPos);
          l.sprite.material.rotation = (l.formedRot * Math.PI) / 180;
        });
      } else {
        cycleStage = "disperse";
        const disperseStart =
          CYCLE.scatterDuration + CYCLE.assembleDuration + CYCLE.holdDuration;
        const t = easeInOutCubic(
          (cycleTime - disperseStart) / CYCLE.disperseDuration
        );
        letterStates.forEach((l) => {
          l.sprite.position.lerpVectors(l.formedPos, l.scatterFrom, t);
          const rot = l.formedRot + (l.scatterRotFrom - l.formedRot) * t;
          l.sprite.material.rotation = (rot * Math.PI) / 180;
        });
      }

      // Subtle breathing pulse on letters regardless of stage
      letterStates.forEach((l) => {
        const pulse = 1.6 + Math.sin(elapsed * 2 + l.pulsePhase) * 0.06;
        l.sprite.scale.set(pulse, pulse, pulse);
      });

      // ── Rebuild connections ──
      let connectionIndex = 0;
      activeConnectionPairs = [];
      for (let i = 0; i < nodes.length && connectionIndex < maxConnections; i++) {
        for (
          let j = i + 1;
          j < nodes.length && connectionIndex < maxConnections;
          j++
        ) {
          const posA = nodes[i].mesh.position;
          const posB = nodes[j].mesh.position;
          const distance = posA.distanceTo(posB);

          if (distance < connectionDistance) {
            const opacity = 1 - distance / connectionDistance;
            const idx = connectionIndex * 6;

            linePositions[idx] = posA.x;
            linePositions[idx + 1] = posA.y;
            linePositions[idx + 2] = posA.z;
            linePositions[idx + 3] = posB.x;
            linePositions[idx + 4] = posB.y;
            linePositions[idx + 5] = posB.z;

            const c = colorA.clone().lerp(colorB, 0.5).multiplyScalar(opacity);
            lineColors[idx] = c.r;
            lineColors[idx + 1] = c.g;
            lineColors[idx + 2] = c.b;
            lineColors[idx + 3] = c.r;
            lineColors[idx + 4] = c.g;
            lineColors[idx + 5] = c.b;

            connectionIndex++;
            activeConnectionPairs.push([posA.clone(), posB.clone()]);
          }
        }
      }
      for (let k = connectionIndex * 6; k < maxConnections * 6; k++) {
        linePositions[k] = 0;
        lineColors[k] = 0;
      }
      lineGeometry.attributes.position.needsUpdate = true;
      lineGeometry.attributes.color.needsUpdate = true;

      // ── Pulses (2x spawn rate) ──
      pulseSpawnTimer += delta;
      if (pulseSpawnTimer > 0.075) {
        spawnPulse();
        pulseSpawnTimer = 0;
      }
      pulses.forEach((p) => {
        if (!p.active) return;
        p.progress += p.speed;
        if (p.progress >= 1) {
          p.active = false;
          (p.sprite.material as THREE.SpriteMaterial).opacity = 0;
          return;
        }
        p.sprite.position.lerpVectors(p.from, p.to, p.progress);
        const fade = Math.sin(p.progress * Math.PI);
        (p.sprite.material as THREE.SpriteMaterial).opacity = 0.9 * fade;
      });

      // 2x rotation speed for parallax
      scene.rotation.y = Math.sin(elapsed * 0.08) * 0.18;
      scene.rotation.x = Math.cos(elapsed * 0.07) * 0.1;

      renderer.render(scene, camera);
      frameId = requestAnimationFrame(animate);
    };

    animate();

    const handleResize = () => {
      const w = container.clientWidth;
      const h = container.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener("resize", handleResize);

    return () => {
      cancelAnimationFrame(frameId);
      window.removeEventListener("resize", handleResize);
      nodeGeometry.dispose();
      lineGeometry.dispose();
      lineMaterial.dispose();
      glowTexture.dispose();
      pulseTexture.dispose();
      nodes.forEach(({ mesh }) => {
        if (mesh instanceof THREE.Sprite || mesh instanceof THREE.Mesh) {
          (mesh.material as THREE.Material).dispose();
        }
      });
      pulses.forEach((p) => (p.sprite.material as THREE.Material).dispose());
      renderer.dispose();
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
    };
  }, [word, fillerNodeCount, connectionDistance, primaryColor, secondaryColor]);

  return (
    <div
      ref={containerRef}
      className={className}
      style={{ position: "fixed", inset: 0, zIndex: -1, pointerEvents: "none" }}
    />
  );
};
