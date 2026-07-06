"use client";

import React, { useEffect, useRef } from "react";
import * as THREE from "three";

interface NeuralBackgroundProps {
  nodeCount?: number;
  connectionDistance?: number;
  primaryColor?: string;
  secondaryColor?: string;
  className?: string;
}

export const NeuralBackground = ({
  nodeCount = 55,
  connectionDistance = 5.5,
  primaryColor = "#7B6EF6",
  secondaryColor = "#2DD4BF",
  className,
}: NeuralBackgroundProps) => {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const width = container.clientWidth;
    const height = container.clientHeight;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(60, width / height, 0.1, 1000);
    camera.position.z = 14;

    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    container.appendChild(renderer.domElement);

    const colorA = new THREE.Color(primaryColor);
    const colorB = new THREE.Color(secondaryColor);

    const nodes: {
      mesh: THREE.Mesh;
      velocity: THREE.Vector3;
      pulsePhase: number;
    }[] = [];

    const nodeGeometry = new THREE.SphereGeometry(0.06, 12, 12);

    const glowTexture = (() => {
      const size = 128;
      const canvas = document.createElement("canvas");
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext("2d")!;
      const gradient = ctx.createRadialGradient(
        size / 2, size / 2, 0, size / 2, size / 2, size / 2
      );
      gradient.addColorStop(0, "rgba(255,255,255,0.9)");
      gradient.addColorStop(1, "rgba(255,255,255,0)");
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, size, size);
      return new THREE.CanvasTexture(canvas);
    })();

    for (let i = 0; i < nodeCount; i++) {
      const mixRatio = Math.random();
      const color = colorA.clone().lerp(colorB, mixRatio);
      const material = new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity: 0.85,
      });
      const mesh = new THREE.Mesh(nodeGeometry, material);
      mesh.position.set(
        (Math.random() - 0.5) * 16,
        (Math.random() - 0.5) * 10,
        (Math.random() - 0.5) * 10
      );
      scene.add(mesh);

      // 2x drift speed vs original version
      nodes.push({
        mesh,
        velocity: new THREE.Vector3(
          (Math.random() - 0.5) * 0.012,
          (Math.random() - 0.5) * 0.012,
          (Math.random() - 0.5) * 0.012
        ),
        pulsePhase: Math.random() * Math.PI * 2,
      });

      const spriteMaterial = new THREE.SpriteMaterial({
        map: glowTexture,
        color,
        transparent: true,
        opacity: 0.35,
        depthWrite: false,
      });
      const sprite = new THREE.Sprite(spriteMaterial);
      sprite.scale.set(0.7, 0.7, 0.7);
      mesh.add(sprite);
    }

    const maxConnections = nodeCount * 6;
    const linePositions = new Float32Array(maxConnections * 2 * 3);
    const lineColors = new Float32Array(maxConnections * 2 * 3);
    const lineGeometry = new THREE.BufferGeometry();
    lineGeometry.setAttribute("position", new THREE.BufferAttribute(linePositions, 3));
    lineGeometry.setAttribute("color", new THREE.BufferAttribute(lineColors, 3));
    const lineMaterial = new THREE.LineBasicMaterial({
      vertexColors: true,
      transparent: true,
      opacity: 0.18,
    });
    const lines = new THREE.LineSegments(lineGeometry, lineMaterial);
    scene.add(lines);

    let frameId: number;
    const clock = new THREE.Clock();

    const animate = () => {
      const elapsed = clock.getElapsedTime();

      nodes.forEach(({ mesh, velocity, pulsePhase }) => {
        mesh.position.add(velocity);
        if (Math.abs(mesh.position.x) > 8) velocity.x *= -1;
        if (Math.abs(mesh.position.y) > 5) velocity.y *= -1;
        if (Math.abs(mesh.position.z) > 5) velocity.z *= -1;

        // 2x pulse speed
        const pulse = 0.85 + Math.sin(elapsed * 3 + pulsePhase) * 0.15;
        mesh.scale.setScalar(pulse);
      });

      let connectionIndex = 0;
      for (let i = 0; i < nodes.length && connectionIndex < maxConnections; i++) {
        for (let j = i + 1; j < nodes.length && connectionIndex < maxConnections; j++) {
          const distance = nodes[i].mesh.position.distanceTo(nodes[j].mesh.position);
          if (distance < connectionDistance) {
            const opacity = 1 - distance / connectionDistance;
            const idx = connectionIndex * 6;
            const posA = nodes[i].mesh.position;
            const posB = nodes[j].mesh.position;

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
          }
        }
      }
      for (let k = connectionIndex * 6; k < maxConnections * 6; k++) {
        linePositions[k] = 0;
        lineColors[k] = 0;
      }
      lineGeometry.attributes.position.needsUpdate = true;
      lineGeometry.attributes.color.needsUpdate = true;

      // 2x rotation speed for parallax
      scene.rotation.y = Math.sin(elapsed * 0.1) * 0.15;
      scene.rotation.x = Math.cos(elapsed * 0.08) * 0.08;

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
      nodes.forEach(({ mesh }) => (mesh.material as THREE.Material).dispose());
      renderer.dispose();
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
    };
  }, [nodeCount, connectionDistance, primaryColor, secondaryColor]);

  return (
    <div
      ref={containerRef}
      className={className}
      style={{ position: "fixed", inset: 0, zIndex: -1, pointerEvents: "none" }}
    />
  );
};
