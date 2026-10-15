import jsPDF from 'jspdf';
import { toPng } from 'html-to-image';

export interface PdfExportProgressCallback {
  (message: string, progress: number): void;
}

/**
 * Professional high-resolution PDF exporter without headers/footers (колонтитули прибрані).
 * Captures discrete page containers (.pdf-export-page) with crisp ~300 DPI (pixelRatio: 2.6)
 * ensuring no pixelation and exact fitting.
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
  // Wait a short moment for fonts, charts, and DOM layouts to fully stabilize
  await new Promise((resolve) => setTimeout(resolve, 500));

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

    // Safari WebKit pre-warm pass (forces WebKit to rasterize foreignObject SVGs & canvases into cache)
    try {
      await toPng(target, {
        pixelRatio: 1,
        backgroundColor: '#ffffff',
        cacheBust: false,
        skipAutoScale: true,
        fontEmbedCSS: '',
        style: {
          borderRadius: '0px',
          border: 'none',
          boxShadow: 'none',
          outline: 'none'
        }
      });
    } catch (err) {
      console.warn('Safari pre-warm pass notice:', err);
    }

    // High resolution PNG capture at stable 2.0x pixelRatio (~300 DPI print crispness)
    // Forcing fixed width of 1200px guarantees identical aspect ratios and uniform margins across all pages
    const pngDataUrl = await toPng(target, {
      pixelRatio: 2.0,
      backgroundColor: '#ffffff',
      cacheBust: false,
      fontEmbedCSS: '',
      style: {
        transform: 'none',
        borderRadius: '0px',
        border: 'none',
        boxShadow: 'none',
        outline: 'none',
        width: '1200px',
        maxWidth: '1200px',
        boxSizing: 'border-box'
      }
    });

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
  }

  onProgress?.('Збереження файлу...', 98);

  const dateStr = new Date().toISOString().split('T')[0];
  const fileName = `pulse_analytics_report_${dateStr}.pdf`;

  pdf.save(fileName);

  return fileName;
}
