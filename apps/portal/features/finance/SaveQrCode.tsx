"use client";

import { Button } from "@/components/r1";
import type { Locale } from "@/lib/i18n/translate";

/** Pixels per module of the saved image: large enough for a banking app to read it from the photo library. */
const SCALE = 8;

/**
 * Save the code (SCR-FIN-01, phone). On a phone the payer cannot scan a code on their own screen, so the
 * code is saved as an image and opened in the banking app. The image is drawn from the code on the page,
 * in the colours the page draws it in, so the saved code and the code on screen are the same code.
 */
export function SaveQrCode({ codeId, fileName, label, locale }: { codeId: string; fileName: string; label: string; locale: Locale }) {
  return (
    <Button variant="secondary" size="md" icon="download" fullWidth onClick={() => save(codeId, fileName)} locale={locale}>
      {label}
    </Button>
  );
}

function save(codeId: string, fileName: string): void {
  const svg = document.getElementById(codeId)?.querySelector("svg");
  const box = svg?.viewBox.baseVal;
  if (svg === undefined || svg === null || box === undefined || box.width === 0) return;
  const canvas = document.createElement("canvas");
  canvas.width = box.width * SCALE;
  canvas.height = box.height * SCALE;
  const context = canvas.getContext("2d");
  if (context === null) return;
  // R1's QrCode draws a paper square and the modules as rects in its ink group.
  const paper = svg.querySelector(".r1-qr__paper");
  const ink = svg.querySelector(".r1-qr__ink");
  if (paper === null || ink === null) return;
  context.fillStyle = getComputedStyle(paper).fill;
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = getComputedStyle(ink).fill;
  for (const module of Array.from(ink.querySelectorAll("rect"))) {
    context.fillRect(module.x.baseVal.value * SCALE, module.y.baseVal.value * SCALE, module.width.baseVal.value * SCALE, module.height.baseVal.value * SCALE);
  }
  canvas.toBlob((blob) => {
    if (blob === null) return;
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = fileName;
    link.click();
    URL.revokeObjectURL(url);
  }, "image/png");
}
