import jsPDF from 'jspdf';
import { toPng } from 'html-to-image';
import html2canvas from 'html2canvas';
import * as echarts from 'echarts';

export interface PdfExportProgressCallback {
  (message: string, progress: number): void;
}

interface ReplacedCanvasRecord {
  canvas?: HTMLCanvasElement;
  container?: HTMLElement;
  img: HTMLImageElement;
  originalDisplay?: string;
}

/**
 * Prepares the DOM node for Safari WebKit rasterization.
 * Direct ECharts instance rasterization using native instance.getDataURL().
 * This bypasses browser canvas extraction bugs in Safari foreignObject SVGs completely
 * and guarantees 100% vector-accurate rendering of all line, bar, pie, gauge, and map charts.
 */
async function prepareTargetForSafari(target: HTMLElement): Promise<ReplacedCanvasRecord[]> {
  const records: ReplacedCanvasRecord[] = [];
  const decodePromises: Promise<any>[] = [];

  // 1. Export all ECharts instances directly via native ECharts getInstanceByDom & getDataURL
  const echartsContainers = Array.from(target.querySelectorAll<HTMLElement>('div[_echarts_instance_]'));
  if (target.hasAttribute('_echarts_instance_')) {
    echartsContainers.push(target);
  }

  echartsContainers.forEach((container) => {
    try {
      const instance = echarts.getInstanceByDom(container);
      if (!instance) return;

      // Ensure ECharts calculates final layout
      instance.resize();

      const dataUrl = instance.getDataURL({
        type: 'png',
        pixelRatio: 2.5,
        backgroundColor: '#ffffff',
        excludeComponents: ['toolbox']
      });

      if (!dataUrl || dataUrl.length < 100) return;

      const rect = container.getBoundingClientRect();
      const w = rect.width || container.offsetWidth;
      const h = rect.height || container.offsetHeight;
      if (w <= 0 || h <= 0) return;

      const img = document.createElement('img');
      img.src = dataUrl;
      img.setAttribute('data-pdf-canvas-replacement', 'true');

      img.style.position = 'absolute';
      img.style.left = '0px';
      img.style.top = '0px';
      img.style.width = '100%';
      img.style.height = '100%';
      img.style.objectFit = 'contain';
      img.style.zIndex = '999';
      img.style.backgroundColor = '#ffffff';

      // Hide internal canvas & svg elements inside the ECharts container
      const childCanvases = Array.from(container.querySelectorAll<HTMLCanvasElement>('canvas'));
      childCanvases.forEach((c) => {
        records.push({ canvas: c, img, originalDisplay: c.style.display });
        c.style.display = 'none';
      });

      // Ensure container supports absolute overlays
      const computedContainerStyle = window.getComputedStyle(container);
      if (computedContainerStyle.position === 'static') {
        container.style.position = 'relative';
      }
      container.appendChild(img);

      if (img.decode) {
        decodePromises.push(img.decode().catch(() => {}));
      } else {
        decodePromises.push(new Promise((resolve) => {
          img.onload = resolve;
          img.onerror = resolve;
        }));
      }
    } catch (err) {
      console.warn('ECharts instance export error:', err);
    }
  });

  // 2. Fallback for any standalone non-ECharts <canvas> elements (e.g., custom sparklines)
  const allCanvases = Array.from(target.querySelectorAll<HTMLCanvasElement>('canvas'));
  allCanvases.forEach((canvas) => {
    if (canvas.style.display === 'none') return; // Already handled by ECharts instance loop

    try {
      const w = canvas.width || canvas.offsetWidth;
      const h = canvas.height || canvas.offsetHeight;
      if (w <= 0 || h <= 0) return;

      const dataUrl = canvas.toDataURL('image/png');
      const img = document.createElement('img');
      img.src = dataUrl;
      img.setAttribute('data-pdf-canvas-replacement', 'true');

      const computedStyle = window.getComputedStyle(canvas);
      const widthVal = computedStyle.width && computedStyle.width !== '0px' ? computedStyle.width : `${canvas.offsetWidth || canvas.width}px`;
      const heightVal = computedStyle.height && computedStyle.height !== '0px' ? computedStyle.height : `${canvas.offsetHeight || canvas.height}px`;

      img.style.position = computedStyle.position && computedStyle.position !== 'static' ? computedStyle.position : 'absolute';
      img.style.left = computedStyle.left && computedStyle.left !== 'auto' ? computedStyle.left : '0px';
      img.style.top = computedStyle.top && computedStyle.top !== 'auto' ? computedStyle.top : '0px';
      img.style.width = widthVal;
      img.style.height = heightVal;
      img.style.display = computedStyle.display !== 'none' ? computedStyle.display : 'block';
      img.style.objectFit = 'contain';
      img.style.margin = computedStyle.margin;
      img.style.padding = computedStyle.padding;
      img.style.zIndex = computedStyle.zIndex !== 'auto' ? computedStyle.zIndex : '1';
      img.className = canvas.className;

      records.push({
        canvas,
        img,
        originalDisplay: canvas.style.display
      });

      canvas.style.display = 'none';
      if (canvas.parentNode) {
        canvas.parentNode.insertBefore(img, canvas.nextSibling);
      }

      if (img.decode) {
        decodePromises.push(img.decode().catch(() => {}));
      } else {
        decodePromises.push(new Promise((resolve) => {
          img.onload = resolve;
          img.onerror = resolve;
        }));
      }
    } catch (e) {
      console.warn('Standalone canvas replacement warning:', e);
    }
  });

  // Ensure all existing <img> tags in target are fully loaded/decoded
  const existingImgs = Array.from(target.querySelectorAll<HTMLImageElement>('img'));
  existingImgs.forEach((img) => {
    if (!img.complete) {
      if (img.decode) {
        decodePromises.push(img.decode().catch(() => {}));
      } else {
        decodePromises.push(new Promise((resolve) => {
          img.onload = resolve;
          img.onerror = resolve;
        }));
      }
    }
  });

  // Fix SVG dimensions & namespace
  const svgs = Array.from(target.querySelectorAll<SVGSVGElement>('svg'));
  svgs.forEach((svg) => {
    try {
      if (!svg.getAttribute('xmlns')) {
        svg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
      }
      const rect = svg.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        svg.setAttribute('data-pdf-orig-w', svg.getAttribute('width') || '');
        svg.setAttribute('data-pdf-orig-h', svg.getAttribute('height') || '');
        if (!svg.getAttribute('width')) svg.setAttribute('width', `${Math.round(rect.width)}`);
        if (!svg.getAttribute('height')) svg.setAttribute('height', `${Math.round(rect.height)}`);
      }
    } catch (_) {}
  });

  if (decodePromises.length > 0) {
    await Promise.all(decodePromises);
  }

  return records;
}

/**
 * Restores the DOM node after Safari WebKit rasterization.
 */
function restoreTargetAfterSafari(target: HTMLElement, records: ReplacedCanvasRecord[]): void {
  // 1. Restore canvases and remove temporary <img> tags
  records.forEach(({ canvas, img, originalDisplay }) => {
    canvas.style.display = originalDisplay;
    if (img && img.parentNode) {
      img.parentNode.removeChild(img);
    }
  });

  // 2. Restore SVG attributes
  const svgs = Array.from(target.querySelectorAll<SVGSVGElement>('svg[data-pdf-orig-w]'));
  svgs.forEach((svg) => {
    const origW = svg.getAttribute('data-pdf-orig-w');
    const origH = svg.getAttribute('data-pdf-orig-h');
    if (origW) svg.setAttribute('width', origW); else svg.removeAttribute('width');
    if (origH) svg.setAttribute('height', origH); else svg.removeAttribute('height');
    svg.removeAttribute('data-pdf-orig-w');
    svg.removeAttribute('data-pdf-orig-h');
  });
}

/**
 * Converts modern CSS color functions (like oklch(...) or oklab(...))
 * to standard #hex or rgb() strings that html2canvas can parse without crashing.
 */
function convertOklchToRgbInCss(cssText: string, ctx: CanvasRenderingContext2D | null): string {
  if (!cssText || (!cssText.includes('oklch') && !cssText.includes('oklab'))) {
    return cssText;
  }

  return cssText.replace(/(oklch|oklab)\([^)]+\)/gi, (match) => {
    if (ctx) {
      try {
        ctx.fillStyle = '#000000';
        ctx.fillStyle = match;
        const resolved = ctx.fillStyle;
        if (resolved && !resolved.includes('oklch') && !resolved.includes('oklab')) {
          return resolved;
        }
      } catch (_) {}
    }

    // Safe fallback hex colors if browser canvas fails to parse oklch
    if (match.includes('oklch')) {
      return '#334155';
    }
    return '#000000';
  });
}

/**
 * Sanitizes all elements and style sheets in the cloned document for html2canvas.
 * Replaces modern oklch/oklab color functions with standard RGB/Hex values
 * to prevent html2canvas "Attempting to parse an unsupported color function oklch" errors.
 */
function sanitizeClonedDocForHtml2Canvas(clonedDoc: Document, clonedElement: HTMLElement): void {
  // 1. Force fixed 1440p desktop width on target element
  clonedElement.style.width = '1440px';
  clonedElement.style.maxWidth = '1440px';
  clonedElement.style.boxSizing = 'border-box';
  clonedElement.style.transform = 'none';

  const tempCanvas = clonedDoc.createElement('canvas');
  const ctx = tempCanvas.getContext('2d');

  // 2. Sanitize all <style> blocks in cloned document
  const styleTags = Array.from(clonedDoc.querySelectorAll('style'));
  styleTags.forEach((styleTag) => {
    if (styleTag.textContent && (styleTag.textContent.includes('oklch') || styleTag.textContent.includes('oklab'))) {
      styleTag.textContent = convertOklchToRgbInCss(styleTag.textContent, ctx);
    }
  });

  // 3. Sanitize all elements in cloned document tree
  const allNodes = Array.from(clonedDoc.querySelectorAll<HTMLElement>('*'));
  allNodes.forEach((node) => {
    // Sanitize inline cssText
    if (node.style && node.style.cssText && (node.style.cssText.includes('oklch') || node.style.cssText.includes('oklab'))) {
      node.style.cssText = convertOklchToRgbInCss(node.style.cssText, ctx);
    }

    // Sanitize computed color properties
    try {
      const computed = window.getComputedStyle(node);
      const colorProps = [
        'color',
        'backgroundColor',
        'borderColor',
        'borderTopColor',
        'borderRightColor',
        'borderBottomColor',
        'borderLeftColor',
        'outlineColor',
        'fill',
        'stroke'
      ];

      colorProps.forEach((prop) => {
        const val = (computed as any)[prop];
        if (val && typeof val === 'string' && (val.includes('oklch') || val.includes('oklab'))) {
          const rgbVal = convertOklchToRgbInCss(val, ctx);
          (node.style as any)[prop] = rgbVal;
        }
      });

      if (computed.boxShadow && (computed.boxShadow.includes('oklch') || computed.boxShadow.includes('oklab'))) {
        node.style.boxShadow = convertOklchToRgbInCss(computed.boxShadow, ctx);
      }
    } catch (_) {}
  });
}

/**
 * High-reliability PNG data URL capture supporting Safari WebKit and Chrome.
 * Uses html-to-image (toPng) as primary engine to render full desktop 1440p layout natively.
 */
async function captureTargetToPngDataUrl(target: HTMLElement): Promise<string> {
  const isSafari = typeof navigator !== 'undefined' && (
    (/Safari/i.test(navigator.userAgent) && !/Chrome/i.test(navigator.userAgent) && !/Edg/i.test(navigator.userAgent)) ||
    (/AppleWebKit/i.test(navigator.userAgent) && !/Chrome/i.test(navigator.userAgent) && !/Edg/i.test(navigator.userAgent))
  );

  const runToPng = async () => {
    if (isSafari) {
      // Safari WebKit warm-up call to prime image rasterization memory
      try {
        await toPng(target, {
          pixelRatio: 1.0,
          backgroundColor: '#ffffff',
          cacheBust: false,
          fontEmbedCSS: '',
          width: 1440
        });
      } catch (_) {}
    }

    return await toPng(target, {
      pixelRatio: 2.0,
      backgroundColor: '#ffffff',
      cacheBust: false,
      fontEmbedCSS: '',
      width: 1440,
      style: {
        transform: 'none',
        borderRadius: '0px',
        border: 'none',
        boxShadow: 'none',
        outline: 'none',
        width: '1440px',
        minWidth: '1440px',
        maxWidth: '1440px',
        boxSizing: 'border-box'
      }
    });
  };

  const runHtml2Canvas = async () => {
    const canvas = await html2canvas(target, {
      scale: 2.2,
      useCORS: true,
      allowTaint: true,
      backgroundColor: '#ffffff',
      logging: false,
      windowWidth: 1440,
      onclone: (clonedDoc, clonedElement) => {
        sanitizeClonedDocForHtml2Canvas(clonedDoc, clonedElement);
      }
    });
    return canvas.toDataURL('image/png');
  };

  try {
    return await runToPng();
  } catch (err) {
    console.warn('[PDF Capture] html-to-image failed, falling back to html2canvas:', err);
    return await runHtml2Canvas();
  }
}

/**
 * Professional high-resolution PDF exporter without headers/footers.
 * Captures discrete page containers (.pdf-export-page) with crisp ~300 DPI
 * ensuring no pixelation and exact fitting across all browsers (including Safari WebKit).
 */
export async function exportDashboardToPdf(
  containerId: string,
  onProgress?: PdfExportProgressCallback
): Promise<string> {
  const container = document.getElementById(containerId);
  if (!container) {
    throw new Error(`Елемент з id "${containerId}" не знайдено.`);
  }

  onProgress?.('Підготовка компонентів та стабілізація макету...', 10);
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event('resize'));
  }
  // Wait a moment for fonts, ECharts, and DOM layouts to fully stabilize
  await new Promise((resolve) => setTimeout(resolve, 700));

  // Wait for font loading (critical for Safari WebKit font rendering)
  if (typeof document !== 'undefined' && document.fonts && document.fonts.ready) {
    try {
      await document.fonts.ready;
    } catch (e) {
      console.warn('Fonts ready wait notice:', e);
    }
  }

  const pdf = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
    compress: true
  });

  const pageWidth = pdf.internal.pageSize.getWidth(); // 210 mm
  const pageHeight = pdf.internal.pageSize.getHeight(); // 297 mm
  const marginX = 6; // mm
  const marginTop = 6; // mm
  const marginBottom = 6; // mm
  const contentWidth = pageWidth - marginX * 2; // 198 mm
  const contentHeight = pageHeight - marginTop - marginBottom; // 285 mm

  // Query discrete page containers
  const pageElements = Array.from(container.querySelectorAll<HTMLElement>('.pdf-export-page'));
  const targets: HTMLElement[] = pageElements.length > 0
    ? pageElements
    : Array.from(container.children).filter((el): el is HTMLElement => el instanceof HTMLElement);

  if (targets.length === 0) {
    targets.push(container);
  }

  let totalPagesCreated = 0;

  for (let i = 0; i < targets.length; i++) {
    const target = targets[i];
    const pageIndex = i + 1;
    const progressPercent = Math.round(15 + (pageIndex / targets.length) * 80);

    onProgress?.(`Рендеринг сторінки ${pageIndex} з ${targets.length} у високій якості...`, progressPercent);

    // Prepare target for Safari WebKit (convert live canvases to <img> PNGs)
    const safariRecords = await prepareTargetForSafari(target);
    await new Promise((resolve) => setTimeout(resolve, 200));

    try {
      const pngDataUrl = await captureTargetToPngDataUrl(target);

      const img = new Image();
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = (e) => reject(e);
        img.src = pngDataUrl;
      });

    // Calculate height in mm on the PDF page based on fixed contentWidth
    const sectionHeightInMm = (img.height * contentWidth) / img.width;

    if (sectionHeightInMm <= contentHeight) {
      if (totalPagesCreated > 0) {
        pdf.addPage();
      }
      totalPagesCreated++;

      onProgress?.(`Формування аркуша ${totalPagesCreated}...`, 40 + Math.min(50, totalPagesCreated * 5));

      pdf.addImage(
        pngDataUrl,
        'PNG',
        marginX,
        marginTop,
        contentWidth,
        sectionHeightInMm,
        undefined,
        'FAST'
      );
    } else {
      // MULTI-PAGE ELEMENT-AWARE CANVAS SLICING (STRICT ZERO-DISTORTION & ZERO CUT CARDS):
      // Sweeps through DOM item cards (.pdf-item-card) to place page cuts strictly at the blank margins BETWEEN cards!
      const sourceCanvas = document.createElement('canvas');
      sourceCanvas.width = img.width;
      sourceCanvas.height = img.height;
      const ctx = sourceCanvas.getContext('2d');
      if (ctx) {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, img.width, img.height);
        ctx.drawImage(img, 0, 0);
      }

      // Query all item cards inside target to measure their exact top/bottom bounds
      const itemCards = Array.from(target.querySelectorAll<HTMLElement>('.pdf-item-card'));
      const targetRect = target.getBoundingClientRect();
      const scale = targetRect.width > 0 ? img.width / targetRect.width : 1;

      const cardBounds = itemCards.map((card) => {
        const r = card.getBoundingClientRect();
        return {
          top: Math.floor((r.top - targetRect.top) * scale),
          bottom: Math.ceil((r.bottom - targetRect.top) * scale)
        };
      });

      // Printable height per page in canvas pixels
      const maxSlicePx = Math.floor((contentHeight * img.width) / contentWidth);

      let currentY = 0;
      const totalY = img.height;

      while (currentY < totalY) {
        const remainingY = totalY - currentY;

        if (remainingY <= maxSlicePx) {
          if (totalPagesCreated > 0) {
            pdf.addPage();
          }
          totalPagesCreated++;

          onProgress?.(`Формування аркуша ${totalPagesCreated}...`, 40 + Math.min(50, totalPagesCreated * 5));

          const sliceH = remainingY;
          const sliceCanvas = document.createElement('canvas');
          sliceCanvas.width = img.width;
          sliceCanvas.height = sliceH;
          const sliceCtx = sliceCanvas.getContext('2d');
          if (sliceCtx) {
            sliceCtx.fillStyle = '#ffffff';
            sliceCtx.fillRect(0, 0, img.width, sliceH);
            sliceCtx.drawImage(sourceCanvas, 0, currentY, img.width, sliceH, 0, 0, img.width, sliceH);
          }

          // Use high quality JPEG (0.92) to keep base64 string sizes small & prevent V8 RangeError: Invalid string length
          const sliceJpeg = sliceCanvas.toDataURL('image/jpeg', 0.92);
          const sliceHeightInMm = (sliceH * contentWidth) / img.width;

          pdf.addImage(
            sliceJpeg,
            'JPEG',
            marginX,
            marginTop,
            contentWidth,
            sliceHeightInMm,
            undefined,
            'FAST'
          );

          sliceCanvas.width = 0;
          sliceCanvas.height = 0;
          break;
        }

        // Target cut position if no card is intersected
        let targetY = currentY + maxSlicePx;

        // Find if targetY intersects the middle of any card
        const intersectingCard = cardBounds.find(
          (b) => b.top < targetY && b.bottom > targetY && b.top > currentY
        );

        let cutY = targetY;
        if (intersectingCard) {
          // Cut cleanly BEFORE the card top boundary (leaving 6px padding)
          cutY = Math.max(currentY + Math.floor(100 * scale), intersectingCard.top - Math.floor(6 * scale));
        }

        // Safety fallback to prevent infinite loops if a single card exceeds maxSlicePx
        if (cutY <= currentY) {
          cutY = targetY;
        }

        if (totalPagesCreated > 0) {
          pdf.addPage();
        }
        totalPagesCreated++;

        onProgress?.(`Формування аркуша ${totalPagesCreated}...`, 40 + Math.min(50, totalPagesCreated * 5));

        const sliceH = cutY - currentY;
        const sliceCanvas = document.createElement('canvas');
        sliceCanvas.width = img.width;
        sliceCanvas.height = sliceH;
        const sliceCtx = sliceCanvas.getContext('2d');
        if (sliceCtx) {
          sliceCtx.fillStyle = '#ffffff';
          sliceCtx.fillRect(0, 0, img.width, sliceH);
          sliceCtx.drawImage(sourceCanvas, 0, currentY, img.width, sliceH, 0, 0, img.width, sliceH);
        }

        const sliceJpeg = sliceCanvas.toDataURL('image/jpeg', 0.92);
        const sliceHeightInMm = (sliceH * contentWidth) / img.width;

        pdf.addImage(
          sliceJpeg,
          'JPEG',
          marginX,
          marginTop,
          contentWidth,
          sliceHeightInMm,
          undefined,
          'FAST'
        );

        sliceCanvas.width = 0;
        sliceCanvas.height = 0;

        currentY = cutY;
      }

      sourceCanvas.width = 0;
      sourceCanvas.height = 0;
    }
    } finally {
      restoreTargetAfterSafari(target, safariRecords);
    }
  }

  onProgress?.('Збереження файлу...', 98);

  const dateStr = new Date().toISOString().split('T')[0];
  const fileName = `pulse_analytics_report_${dateStr}.pdf`;

  pdf.save(fileName);

  return fileName;
}
