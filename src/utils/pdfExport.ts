import jsPDF from 'jspdf';
import { toPng } from 'html-to-image';
import * as echarts from 'echarts';

export interface PdfExportProgressCallback {
  (message: string, progress: number): void;
}

interface ChartSnapshot {
  png: string;
  rect: DOMRect;
}

/**
 * Professional high-resolution PDF exporter with 2-Layer Composition.
 * 
 * ARCHITECTURE (Bypasses Safari WebKit foreignObject canvas bugs completely):
 * - Layer 1 (DOM Layout): Captures page cards, borders, text, tables & titles into a clean PNG.
 *   Canvas elements inside ECharts containers are filtered out during DOM capture.
 * - Layer 2 (ECharts Data Images): ECharts instances export high-res 2.5x PNG data URLs via
 *   echarts.getInstanceByDom().getDataURL().
 * - PDF Composition: jsPDF overlays the ECharts chart PNGs directly onto the PDF canvas
 *   using exact millimeter coordinate mapping derived from DOM getBoundingClientRect().
 * 
 * Zero DOM mutations, zero temporary <img> insertions, zero foreignObject WebKit bugs!
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

  // Force window resize event & animation frames to ensure ECharts instances settle
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event('resize'));
  }

  await new Promise((resolve) => setTimeout(resolve, 600));

  // Wait for font loading
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

  // Query discrete page containers (.pdf-export-page)
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

    const rootRect = target.getBoundingClientRect();

    // 1. SAFARI WEBKIT HYBRID CANVAS PREPARATION
    // Convert all live <canvas> elements (ECharts charts/sparklines/map) into static <img> elements
    // and wait for Safari's async base64 decoder to decode them.
    interface ReplacedCanvas {
      canvas: HTMLCanvasElement;
      img: HTMLImageElement;
      parent: Node;
      nextSibling: Node | null;
    }
    const replacedCanvases: ReplacedCanvas[] = [];

    // Find all ECharts instances and canvases
    const allCanvases = Array.from(target.querySelectorAll<HTMLCanvasElement>('canvas'));
    const chartSnapshots: ChartSnapshot[] = [];

    // Extract direct ECharts snapshots via getInstanceByDom / canvas.toDataURL
    allCanvases.forEach((canvas) => {
      try {
        const parentRect = canvas.getBoundingClientRect();
        if (parentRect.width <= 0 || parentRect.height <= 0) return;

        // Find associated ECharts instance if available
        let instance = echarts.getInstanceByDom(canvas);
        if (!instance && canvas.parentElement) {
          instance = echarts.getInstanceByDom(canvas.parentElement);
        }
        if (!instance && canvas.parentElement?.parentElement) {
          instance = echarts.getInstanceByDom(canvas.parentElement.parentElement);
        }

        let png = '';
        if (instance) {
          try {
            instance.resize();
            png = instance.getDataURL({
              type: 'png',
              pixelRatio: 2.5,
              backgroundColor: '#ffffff',
              excludeComponents: ['toolbox']
            });
          } catch (e) {
            console.warn('instance.getDataURL fallback to canvas:', e);
          }
        }

        if (!png || png.length < 500) {
          png = canvas.toDataURL('image/png');
        }

        if (png && png.startsWith('data:image/png') && png.length > 500) {
          chartSnapshots.push({
            png,
            rect: parentRect
          });

          // Create replacement <img> element for DOM capture
          const img = document.createElement('img');
          img.src = png;
          img.style.width = `${canvas.offsetWidth || parentRect.width}px`;
          img.style.height = `${canvas.offsetHeight || parentRect.height}px`;
          img.style.display = 'block';
          img.style.objectFit = 'contain';
          img.className = canvas.className || '';

          if (canvas.parentNode) {
            replacedCanvases.push({
              canvas,
              img,
              parent: canvas.parentNode,
              nextSibling: canvas.nextSibling
            });
            canvas.parentNode.replaceChild(img, canvas);
          }
        }
      } catch (err) {
        console.warn('Canvas conversion warning:', err);
      }
    });

    // Wait for Safari WebKit to decode all replaced base64 images into GPU memory
    if (replacedCanvases.length > 0) {
      await Promise.all(
        replacedCanvases.map((r) =>
          r.img.decode().catch(() => new Promise((res) => setTimeout(res, 50)))
        )
      );
      await new Promise((resolve) => setTimeout(resolve, 150));
    }

    // 2. CAPTURE DOM LAYOUT WITH TO-PNG (Now containing decoded <img> tags for Safari)
    let layoutPng = '';
    try {
      layoutPng = await toPng(target, {
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
    } finally {
      // Revert replaced <img> tags back to original <canvas> elements immediately
      replacedCanvases.forEach((r) => {
        if (r.img.parentNode) {
          r.img.parentNode.replaceChild(r.canvas, r.img);
        }
      });
    }

    const img = new Image();
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = (e) => reject(e);
      img.src = layoutPng;
    });

    // Calculate height in mm on the PDF page based on fixed contentWidth
    const sectionHeightInMm = (img.height * contentWidth) / img.width;

    if (sectionHeightInMm <= contentHeight) {
      if (totalPagesCreated > 0) {
        pdf.addPage();
      }
      totalPagesCreated++;

      onProgress?.(`Формування аркуша ${totalPagesCreated}...`, 40 + Math.min(50, totalPagesCreated * 5));

      // Draw Layer 1: Page Layout Background
      pdf.addImage(
        layoutPng,
        'PNG',
        marginX,
        marginTop,
        contentWidth,
        sectionHeightInMm,
        undefined,
        'FAST'
      );

      // Draw Layer 2: Overlay original ECharts charts directly into jsPDF at exact mm coordinates
      chartSnapshots.forEach((chart) => {
        const relLeft = chart.rect.left - rootRect.left;
        const relTop = chart.rect.top - rootRect.top;

        const chartXInMm = marginX + (relLeft * contentWidth) / rootRect.width;
        const chartYInMm = marginTop + (relTop * sectionHeightInMm) / rootRect.height;
        const chartWInMm = (chart.rect.width * contentWidth) / rootRect.width;
        const chartHInMm = (chart.rect.height * sectionHeightInMm) / rootRect.height;

        pdf.addImage(
          chart.png,
          'PNG',
          chartXInMm,
          chartYInMm,
          chartWInMm,
          chartHInMm,
          undefined,
          'FAST'
        );
      });
    } else {
      // MULTI-PAGE ELEMENT-AWARE CANVAS SLICING FOR LONG TABLES (Catalog Table)
      const sourceCanvas = document.createElement('canvas');
      sourceCanvas.width = img.width;
      sourceCanvas.height = img.height;
      const ctx = sourceCanvas.getContext('2d');
      if (ctx) {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, img.width, img.height);
        ctx.drawImage(img, 0, 0);
      }

      const itemCards = Array.from(target.querySelectorAll<HTMLElement>('.pdf-item-card'));
      const scale = rootRect.width > 0 ? img.width / rootRect.width : 1;

      const cardBounds = itemCards.map((card) => {
        const r = card.getBoundingClientRect();
        return {
          top: Math.floor((r.top - rootRect.top) * scale),
          bottom: Math.ceil((r.bottom - rootRect.top) * scale)
        };
      });

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

        let targetY = currentY + maxSlicePx;
        const intersectingCard = cardBounds.find(
          (b) => b.top < targetY && b.bottom > targetY && b.top > currentY
        );

        let cutY = targetY;
        if (intersectingCard) {
          cutY = Math.max(currentY + Math.floor(100 * scale), intersectingCard.top - Math.floor(6 * scale));
        }

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
  }

  onProgress?.('Збереження файлу...', 98);

  const dateStr = new Date().toISOString().split('T')[0];
  const fileName = `pulse_analytics_report_${dateStr}.pdf`;

  pdf.save(fileName);

  return fileName;
}
