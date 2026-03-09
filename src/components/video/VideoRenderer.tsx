import { useRef, useEffect, useState, useCallback, forwardRef, useImperativeHandle } from "react";

export interface SlideElement {
  type: "text" | "shape" | "cta" | "image";
  content?: string;
  src?: string;
  x: number;
  y: number;
  width?: number;
  height?: number;
  fontSize?: number;
  fontWeight?: string;
  color?: string;
  bgColor?: string;
  textAlign?: string;
  maxWidth?: number;
  shape?: "circle" | "rect" | "rounded" | "line" | "diamond";
  borderRadius?: number;
  paddingX?: number;
  paddingY?: number;
  animation?: string;
  animationDelay?: number;
  opacity?: number;
  rotation?: number;
  blur?: number;
  shadow?: boolean;
  gradient?: string[];
}

export interface SlideBackground {
  type: "solid" | "gradient" | "image";
  color?: string;
  colors?: string[];
  angle?: number;
  src?: string;
  overlay?: string;
}

export interface Slide {
  id: string;
  duration: number;
  background: SlideBackground;
  elements: SlideElement[];
  transition?: "fade" | "slide" | "zoom" | "wipe";
}

export interface SceneData {
  title: string;
  duration: number;
  width: number;
  height: number;
  backgroundColor?: string;
  slides: Slide[];
}

export interface VideoRendererHandle {
  play: () => void;
  pause: () => void;
  restart: () => void;
  exportVideo: () => Promise<Blob>;
}

interface Props {
  sceneData: SceneData;
  className?: string;
  autoPlay?: boolean;
  showControls?: boolean;
}

// Easing functions
function easeOutBack(t: number) {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
}
function easeOutCubic(t: number) { return 1 - Math.pow(1 - t, 3); }
function easeOutElastic(t: number) {
  if (t === 0 || t === 1) return t;
  return Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * (2 * Math.PI) / 3) + 1;
}
function easeInOutQuart(t: number) {
  return t < 0.5 ? 8 * t * t * t * t : 1 - Math.pow(-2 * t + 2, 4) / 2;
}

function getAnimationProgress(animation: string | undefined, progress: number, delay: number = 0) {
  const raw = Math.max(0, Math.min(1, (progress - delay) / Math.max(0.01, 0.6 - delay)));

  switch (animation) {
    case "fadeUp": {
      const e = easeOutCubic(raw);
      return { opacity: e, translateY: (1 - e) * 60, scale: 1 };
    }
    case "fadeDown": {
      const e = easeOutCubic(raw);
      return { opacity: e, translateY: -(1 - e) * 60, scale: 1 };
    }
    case "fadeIn": {
      const e = easeOutCubic(raw);
      return { opacity: e, translateY: 0, scale: 1 };
    }
    case "slideLeft": {
      const e = easeOutBack(raw);
      return { opacity: Math.min(1, raw * 3), translateX: (1 - e) * 200, scale: 1 };
    }
    case "slideRight": {
      const e = easeOutBack(raw);
      return { opacity: Math.min(1, raw * 3), translateX: -(1 - e) * 200, scale: 1 };
    }
    case "scale": {
      const e = easeOutElastic(raw);
      return { opacity: Math.min(1, raw * 2), scale: e };
    }
    case "scaleUp": {
      const e = easeOutBack(raw);
      return { opacity: Math.min(1, raw * 2), scale: 0.3 + e * 0.7 };
    }
    case "bounce": {
      const e = easeOutElastic(raw);
      return { opacity: Math.min(1, raw * 3), translateY: (1 - e) * 80, scale: 1 };
    }
    case "spin": {
      const e = easeOutCubic(raw);
      return { opacity: Math.min(1, raw * 2), rotation: (1 - e) * 180, scale: e };
    }
    case "typewriter":
      return { opacity: 1, charCount: easeInOutQuart(raw), scale: 1 };
    case "blur": {
      const e = easeOutCubic(raw);
      return { opacity: e, blur: (1 - e) * 15, scale: 1 };
    }
    case "popIn": {
      const e = easeOutElastic(raw);
      return { opacity: Math.min(1, raw * 2), scale: e * 1.0 };
    }
    default:
      return { opacity: 1, translateY: 0, scale: 1 };
  }
}

const VideoRenderer = forwardRef<VideoRendererHandle, Props>(
  ({ sceneData, className = "", autoPlay = true, showControls = true }, ref) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const animFrameRef = useRef<number>(0);
    const startTimeRef = useRef<number>(0);
    const [isPlaying, setIsPlaying] = useState(false);
    const [currentTime, setCurrentTime] = useState(0);
    const imageCache = useRef<Map<string, HTMLImageElement>>(new Map());

    const totalDuration = sceneData.slides.reduce((s, sl) => s + sl.duration, 0);
    const scaleW = sceneData.width;
    const scaleH = sceneData.height;

    const loadImage = useCallback((src: string): Promise<HTMLImageElement> => {
      if (imageCache.current.has(src)) return Promise.resolve(imageCache.current.get(src)!);
      return new Promise((resolve) => {
        const img = new Image();
        img.crossOrigin = "anonymous";
        img.onload = () => { imageCache.current.set(src, img); resolve(img); };
        img.onerror = () => resolve(img);
        img.src = src;
      });
    }, []);

    const drawFrame = useCallback((time: number) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      const loopedTime = time % totalDuration;

      // Find current slide and next slide for transitions
      let elapsed = 0;
      let currentSlide: Slide | null = null;
      let nextSlide: Slide | null = null;
      let slideProgress = 0;
      let slideIdx = 0;

      for (let i = 0; i < sceneData.slides.length; i++) {
        const slide = sceneData.slides[i];
        if (loopedTime < elapsed + slide.duration) {
          currentSlide = slide;
          nextSlide = sceneData.slides[i + 1] || sceneData.slides[0];
          slideProgress = (loopedTime - elapsed) / slide.duration;
          slideIdx = i;
          break;
        }
        elapsed += slide.duration;
      }

      if (!currentSlide) {
        currentSlide = sceneData.slides[sceneData.slides.length - 1];
        slideProgress = 1;
      }

      ctx.clearRect(0, 0, scaleW, scaleH);

      // Slide transition effect (last 15% of slide)
      const transitionStart = 0.85;
      const inTransition = slideProgress > transitionStart;
      const transitionProgress = inTransition ? (slideProgress - transitionStart) / (1 - transitionStart) : 0;
      const transType = currentSlide.transition || "fade";

      // Draw background
      const drawBg = (slide: Slide, alpha: number = 1) => {
        ctx.save();
        ctx.globalAlpha = alpha;
        const bg = slide.background;
        if (bg.type === "image" && bg.src && imageCache.current.has(bg.src)) {
          const img = imageCache.current.get(bg.src)!;
          // Ken Burns effect - slow zoom
          const zoom = 1 + slideProgress * 0.08;
          const iw = scaleW * zoom;
          const ih = scaleH * zoom;
          ctx.drawImage(img, (scaleW - iw) / 2, (scaleH - ih) / 2, iw, ih);
          // Overlay
          if (bg.overlay) {
            ctx.fillStyle = bg.overlay;
            ctx.fillRect(0, 0, scaleW, scaleH);
          }
        } else if (bg.type === "gradient" && bg.colors?.length) {
          const angle = ((bg.angle || 135) * Math.PI) / 180;
          const cx = scaleW / 2; const cy = scaleH / 2;
          const len = Math.max(scaleW, scaleH);
          const grad = ctx.createLinearGradient(
            cx - Math.cos(angle) * len, cy - Math.sin(angle) * len,
            cx + Math.cos(angle) * len, cy + Math.sin(angle) * len
          );
          bg.colors.forEach((c, i) => grad.addColorStop(i / (bg.colors!.length - 1), c));
          ctx.fillStyle = grad;
          ctx.fillRect(0, 0, scaleW, scaleH);
        } else {
          ctx.fillStyle = bg.color || sceneData.backgroundColor || "#0f0f23";
          ctx.fillRect(0, 0, scaleW, scaleH);
        }
        ctx.restore();
      };

      drawBg(currentSlide);

      // Transition overlay from next slide
      if (inTransition && nextSlide) {
        const tp = easeOutCubic(transitionProgress);
        if (transType === "fade") {
          drawBg(nextSlide, tp);
        } else if (transType === "wipe") {
          ctx.save();
          ctx.beginPath();
          ctx.rect(0, 0, scaleW * tp, scaleH);
          ctx.clip();
          drawBg(nextSlide);
          ctx.restore();
        }
      }

      // Draw elements with enhanced animations
      for (const el of currentSlide.elements) {
        const anim = getAnimationProgress(el.animation, slideProgress, el.animationDelay || 0);
        const opacity = (anim.opacity ?? 1) * (el.opacity ?? 1);
        if (opacity <= 0.01) continue;

        // Fade out near end of slide
        const fadeOutAlpha = slideProgress > 0.8 ? 1 - (slideProgress - 0.8) / 0.2 : 1;

        ctx.save();
        ctx.globalAlpha = opacity * fadeOutAlpha;

        const tx = (anim as any).translateX || 0;
        const ty = (anim as any).translateY || 0;
        const scale = (anim as any).scale || 1;
        const rotation = ((anim as any).rotation || 0) + (el.rotation || 0);
        const blurAmount = (anim as any).blur || el.blur || 0;

        ctx.translate(el.x + tx, el.y + ty);
        if (rotation) ctx.rotate((rotation * Math.PI) / 180);
        if (scale !== 1) ctx.scale(scale, scale);
        if (blurAmount > 0) ctx.filter = `blur(${blurAmount}px)`;

        if (el.type === "text") {
          const weight = el.fontWeight === "bold" ? "bold" : "normal";
          const fs = el.fontSize || 36;
          ctx.font = `${weight} ${fs}px "Inter", "SF Pro Display", Helvetica, Arial, sans-serif`;
          ctx.fillStyle = el.color || "#ffffff";
          ctx.textAlign = (el.textAlign as CanvasTextAlign) || "center";
          ctx.textBaseline = "middle";

          // Text shadow
          if (el.shadow !== false) {
            ctx.shadowColor = "rgba(0,0,0,0.4)";
            ctx.shadowBlur = 12;
            ctx.shadowOffsetY = 4;
          }

          let text = el.content || "";
          if (el.animation === "typewriter" && (anim as any).charCount !== undefined) {
            text = text.slice(0, Math.floor(text.length * (anim as any).charCount));
          }

          const maxW = el.maxWidth || scaleW - 120;
          const words = text.split(" ");
          const lines: string[] = [];
          let currentLine = "";
          for (const word of words) {
            const test = currentLine ? `${currentLine} ${word}` : word;
            if (ctx.measureText(test).width > maxW && currentLine) {
              lines.push(currentLine);
              currentLine = word;
            } else {
              currentLine = test;
            }
          }
          if (currentLine) lines.push(currentLine);

          const lineHeight = fs * 1.35;
          const startY = -(lines.length - 1) * lineHeight / 2;
          lines.forEach((line, i) => ctx.fillText(line, 0, startY + i * lineHeight));

        } else if (el.type === "cta") {
          const text = el.content || "Learn More";
          const fs = el.fontSize || 32;
          ctx.font = `bold ${fs}px "Inter", Helvetica, sans-serif`;
          const measured = ctx.measureText(text).width;
          const px = el.paddingX || 50;
          const py = el.paddingY || 18;
          const bw = measured + px * 2;
          const bh = fs + py * 2;
          const br = el.borderRadius || 50;

          // Button shadow
          ctx.shadowColor = "rgba(0,0,0,0.3)";
          ctx.shadowBlur = 20;
          ctx.shadowOffsetY = 8;

          // Gradient button or solid
          if (el.gradient?.length) {
            const grad = ctx.createLinearGradient(-bw / 2, 0, bw / 2, 0);
            el.gradient.forEach((c, i) => grad.addColorStop(i / (el.gradient!.length - 1), c));
            ctx.fillStyle = grad;
          } else {
            ctx.fillStyle = el.bgColor || "#ffffff";
          }
          ctx.beginPath();
          ctx.roundRect(-bw / 2, -bh / 2, bw, bh, br);
          ctx.fill();

          // Reset shadow for text
          ctx.shadowColor = "transparent";
          ctx.fillStyle = el.color || "#000000";
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText(text, 0, 2);

        } else if (el.type === "shape") {
          if (el.gradient?.length) {
            const grad = ctx.createLinearGradient(0, -(el.height || 60) / 2, 0, (el.height || 60) / 2);
            el.gradient.forEach((c, i) => grad.addColorStop(i / (el.gradient!.length - 1), c));
            ctx.fillStyle = grad;
          } else {
            ctx.fillStyle = el.color || "#ffffff22";
          }

          if (el.shape === "circle") {
            const r = (el.width || 60) / 2;
            ctx.beginPath();
            ctx.arc(0, 0, r, 0, Math.PI * 2);
            ctx.fill();
          } else if (el.shape === "diamond") {
            const s = (el.width || 60) / 2;
            ctx.beginPath();
            ctx.moveTo(0, -s);
            ctx.lineTo(s, 0);
            ctx.lineTo(0, s);
            ctx.lineTo(-s, 0);
            ctx.closePath();
            ctx.fill();
          } else if (el.shape === "line") {
            ctx.strokeStyle = el.color || "#ffffff33";
            ctx.lineWidth = el.height || 2;
            ctx.beginPath();
            ctx.moveTo(-(el.width || 200) / 2, 0);
            ctx.lineTo((el.width || 200) / 2, 0);
            ctx.stroke();
          } else {
            const w = el.width || 60;
            const h = el.height || 60;
            const r = el.borderRadius || 0;
            ctx.beginPath();
            ctx.roundRect(-w / 2, -h / 2, w, h, r);
            ctx.fill();
          }

        } else if (el.type === "image" && el.src && imageCache.current.has(el.src)) {
          const img = imageCache.current.get(el.src)!;
          const w = el.width || 300;
          const h = el.height || 300;
          const r = el.borderRadius || 0;
          if (r > 0) {
            ctx.beginPath();
            ctx.roundRect(-w / 2, -h / 2, w, h, r);
            ctx.clip();
          }
          ctx.drawImage(img, -w / 2, -h / 2, w, h);
        }

        ctx.restore();
      }

      // Film grain overlay for cinematic feel
      ctx.save();
      ctx.globalAlpha = 0.03;
      for (let i = 0; i < 100; i++) {
        const gx = Math.random() * scaleW;
        const gy = Math.random() * scaleH;
        ctx.fillStyle = Math.random() > 0.5 ? "#fff" : "#000";
        ctx.fillRect(gx, gy, 2, 2);
      }
      ctx.restore();

      // Subtle vignette
      const vignette = ctx.createRadialGradient(scaleW / 2, scaleH / 2, scaleW * 0.35, scaleW / 2, scaleH / 2, scaleW * 0.9);
      vignette.addColorStop(0, "transparent");
      vignette.addColorStop(1, "rgba(0,0,0,0.25)");
      ctx.fillStyle = vignette;
      ctx.fillRect(0, 0, scaleW, scaleH);
    }, [sceneData, scaleW, scaleH, totalDuration]);

    const animate = useCallback((timestamp: number) => {
      if (!startTimeRef.current) startTimeRef.current = timestamp;
      const elapsed = (timestamp - startTimeRef.current) / 1000;
      setCurrentTime(elapsed % totalDuration);
      drawFrame(elapsed);
      animFrameRef.current = requestAnimationFrame(animate);
    }, [drawFrame, totalDuration]);

    const play = useCallback(() => {
      setIsPlaying(true);
      startTimeRef.current = 0;
      animFrameRef.current = requestAnimationFrame(animate);
    }, [animate]);

    const pause = useCallback(() => {
      setIsPlaying(false);
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    }, []);

    const restart = useCallback(() => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      startTimeRef.current = 0;
      setCurrentTime(0);
      setIsPlaying(true);
      animFrameRef.current = requestAnimationFrame(animate);
    }, [animate]);

    const exportVideo = useCallback(async (): Promise<Blob> => {
      const canvas = canvasRef.current;
      if (!canvas) throw new Error("Canvas not available");
      const stream = canvas.captureStream(30);
      const recorder = new MediaRecorder(stream, {
        mimeType: "video/webm;codecs=vp9",
        videoBitsPerSecond: 5000000,
      });
      const chunks: Blob[] = [];
      recorder.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };
      return new Promise((resolve) => {
        recorder.onstop = () => resolve(new Blob(chunks, { type: "video/webm" }));
        recorder.start();
        const fps = 30;
        const totalFrames = Math.ceil(totalDuration * fps);
        let frame = 0;
        const renderFrame = () => {
          drawFrame(frame / fps);
          frame++;
          if (frame <= totalFrames) requestAnimationFrame(renderFrame);
          else recorder.stop();
        };
        renderFrame();
      });
    }, [drawFrame, totalDuration]);

    useImperativeHandle(ref, () => ({ play, pause, restart, exportVideo }));

    useEffect(() => {
      drawFrame(0);
      if (autoPlay) play();
      return () => { if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current); };
    }, [sceneData]);

    // Preload images
    useEffect(() => {
      sceneData.slides.forEach((slide) => {
        if (slide.background.type === "image" && slide.background.src) loadImage(slide.background.src);
        slide.elements.forEach((el) => { if (el.type === "image" && el.src) loadImage(el.src); });
      });
    }, [sceneData, loadImage]);

    const progressPercent = (currentTime / totalDuration) * 100;

    return (
      <div className={`relative ${className}`}>
        <div className="relative rounded-lg overflow-hidden bg-muted/20 border border-border/30"
          style={{ aspectRatio: `${sceneData.width}/${sceneData.height}`, maxHeight: "70vh" }}>
          <canvas ref={canvasRef} width={sceneData.width} height={sceneData.height} className="w-full h-full object-contain" />
        </div>
        {showControls && (
          <div className="mt-2 space-y-1">
            <div className="h-1.5 bg-secondary/50 rounded-full overflow-hidden">
              <div className="h-full bg-primary rounded-full transition-all duration-100" style={{ width: `${progressPercent}%` }} />
            </div>
            <div className="flex items-center gap-2">
              <button onClick={isPlaying ? pause : play} className="text-xs text-muted-foreground hover:text-foreground transition-colors">
                {isPlaying ? "⏸ Pause" : "▶ Play"}
              </button>
              <button onClick={restart} className="text-xs text-muted-foreground hover:text-foreground transition-colors">↺ Restart</button>
              <span className="text-[10px] text-muted-foreground ml-auto">{currentTime.toFixed(1)}s / {totalDuration.toFixed(1)}s</span>
            </div>
          </div>
        )}
      </div>
    );
  }
);

VideoRenderer.displayName = "VideoRenderer";
export default VideoRenderer;
