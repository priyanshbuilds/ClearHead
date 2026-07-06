"use client";

import { cn } from "@/lib/utils";
import React, { useEffect, useRef } from "react";

interface VortexProps {
  children?: React.ReactNode;
  className?: string;
  containerClassName?: string;
  particleCount?: number;
  rangeY?: number;
  baseHue?: number;
  baseSpeed?: number;
  rangeSpeed?: number;
  baseRadius?: number;
  rangeRadius?: number;
  backgroundColor?: string;
}

export const Vortex = (props: VortexProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const animationFrameRef = useRef<number>(0);

  const particleCount = props.particleCount || 500;
  const baseSpeed = props.baseSpeed || 0.0;
  const rangeSpeed = props.rangeSpeed || 1.5;
  const baseRadius = props.baseRadius || 1;
  const rangeRadius = props.rangeRadius || 2;
  const baseHue = props.baseHue || 220;
  const backgroundColor = props.backgroundColor || "#080810";

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let width = container.clientWidth;
    let height = container.clientHeight;
    canvas.width = width;
    canvas.height = height;

    const particles: {
      x: number;
      y: number;
      angle: number;
      radius: number;
      speed: number;
      hue: number;
    }[] = [];

    const centerX = width / 2;
    const centerY = height / 2;

    for (let i = 0; i < particleCount; i++) {
      const radius = Math.random() * Math.min(width, height) * 0.45;
      const angle = Math.random() * Math.PI * 2;
      particles.push({
        x: centerX + Math.cos(angle) * radius,
        y: centerY + Math.sin(angle) * radius,
        angle,
        radius,
        speed: baseSpeed + Math.random() * rangeSpeed,
        hue: baseHue + Math.random() * 60 - 30,
      });
    }

    const resize = () => {
      width = container.clientWidth;
      height = container.clientHeight;
      canvas.width = width;
      canvas.height = height;
    };
    window.addEventListener("resize", resize);

    const render = () => {
      ctx.fillStyle = backgroundColor;
      ctx.globalAlpha = 0.15;
      ctx.fillRect(0, 0, width, height);
      ctx.globalAlpha = 1;

      const cx = width / 2;
      const cy = height / 2;

      particles.forEach((p) => {
        p.angle += 0.002 * p.speed;
        p.x = cx + Math.cos(p.angle) * p.radius;
        p.y = cy + Math.sin(p.angle) * p.radius * 0.6;

        const size = baseRadius + Math.random() * rangeRadius;
        ctx.beginPath();
        ctx.arc(p.x, p.y, size, 0, Math.PI * 2);
        ctx.fillStyle = `hsla(${p.hue}, 80%, 65%, 0.7)`;
        ctx.fill();
      });

      animationFrameRef.current = requestAnimationFrame(render);
    };

    render();

    return () => {
      window.removeEventListener("resize", resize);
      cancelAnimationFrame(animationFrameRef.current);
    };
  }, [particleCount, baseSpeed, rangeSpeed, baseRadius, rangeRadius, baseHue, backgroundColor]);

  return (
    <div
      ref={containerRef}
      className={cn("relative h-full w-full overflow-hidden", props.containerClassName)}
    >
      <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />
      <div className={cn("relative z-10", props.className)}>
        {props.children}
      </div>
    </div>
  );
};
