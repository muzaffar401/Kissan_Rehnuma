/**
 * PDF Report Service for Kissan Rehnuma.
 *
 * Generates a professional crop disease diagnosis report as PDF.
 *
 * Platforms:
 * - Web: jsPDF generates PDF → doc.save() triggers direct browser download
 * - Native (Android/iOS): expo-print generates PDF → expo-sharing opens share sheet
 *
 * Note: expo-print's web implementation is just window.print() — it cannot
 * generate a file or return base64 data. So we use jsPDF on web for proper
 * direct download without the print dialog.
 */

import { Platform } from 'react-native';
import * as Print from 'expo-print';
import { shareAsync } from 'expo-sharing';

import type { DetectResponse } from './cropService';
import type { AnimalDetectResponse } from './animalService';

/** Normalized report data — works for both crop and animal scans */
interface NormalizedReport {
  scan_id: string;
  is_positive: boolean;
  disease_name: string | null;
  scientific_name: string | null;
  confidence: number | null;
  symptoms: string[];
  causes: string;
  treatment_recommendations: string;
  prevention_tips: string[];
  category_label: string;
  category_value: string | null;
  affected_label: string;
  affected_value: string;
  image_url: string;
  language: string;
  message: string;
}

/** Normalize crop or animal response into a single shape for PDF rendering */
function normalizeReport(data: DetectResponse | AnimalDetectResponse): NormalizedReport {
  if ('is_plant' in data) {
    return {
      scan_id: data.scan_id,
      is_positive: data.is_plant,
      disease_name: data.disease_name,
      scientific_name: data.scientific_name,
      confidence: data.confidence,
      symptoms: data.symptoms || [],
      causes: data.causes,
      treatment_recommendations: data.treatment_recommendations,
      prevention_tips: data.prevention_tips || [],
      category_label: 'Crop',
      category_value: data.crop_type,
      affected_label: 'Affected Crops',
      affected_value: data.affected_crops,
      image_url: data.image_url,
      language: data.language,
      message: data.message,
    };
  }
  return {
    scan_id: data.scan_id,
    is_positive: data.is_animal,
    disease_name: data.disease_name,
    scientific_name: data.scientific_name,
    confidence: data.confidence,
    symptoms: data.symptoms || [],
    causes: data.causes,
    treatment_recommendations: data.treatment_recommendations,
    prevention_tips: data.prevention_tips || [],
    category_label: 'Animal',
    category_value: data.animal_type,
    affected_label: 'Affected Species',
    affected_value: data.affected_species,
    image_url: data.image_url,
    language: data.language,
    message: data.message,
  };
}

// =========================================================
// HTML Template
// =========================================================

function buildReportHtml(data: DetectResponse | AnimalDetectResponse): string {
  const d = normalizeReport(data);
  const now = new Date();
  const dateStr = now.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
  const timeStr = now.toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
  });

  const confidencePercent =
    d.confidence != null ? (d.confidence * 100).toFixed(1) : 'N/A';

  const isHealthy = d.disease_name?.toLowerCase() === 'healthy';
  const statusColor = isHealthy ? '#2E7D32' : '#E65100';
  const statusText = isHealthy ? 'Healthy' : 'Disease Detected';

  // Detect RTL content for proper font and direction
  const isRtl = reportHasRtl(d);
  const googleFontLink = isRtl
    ? `<link href="https://fonts.googleapis.com/css2?family=Noto+Naskh+Arabic:wght@400;500;600;700&display=swap" rel="stylesheet">`
    : '';
  const bodyFontFamily = isRtl
    ? "'Noto Naskh Arabic', 'Helvetica Neue', Helvetica, Arial, sans-serif"
    : "'Helvetica Neue', Helvetica, Arial, sans-serif";
  const bodyDirection = isRtl ? 'rtl' : 'ltr';

  // Build symptom bullets
  const symptomsHtml =
    d.symptoms.length > 0
      ? d.symptoms.map((s) => `<li>${escapeHtml(s)}</li>`).join('\n')
      : '<li>No symptoms reported</li>';

  // Build prevention bullets
  const preventionHtml =
    d.prevention_tips.length > 0
      ? d.prevention_tips.map((p) => `<li>${escapeHtml(p)}</li>`).join('\n')
      : '<li>No prevention tips available</li>';

  // Treatment (string)
  const treatmentHtml = d.treatment_recommendations
    ? escapeHtml(d.treatment_recommendations)
    : 'No treatment recommendations available.';

  // Causes (string)
  const causesHtml = d.causes
    ? escapeHtml(d.causes)
    : 'No causes information available.';

  // Affected crops/species
  const cropsHtml = d.affected_value
    ? escapeHtml(d.affected_value)
    : 'Not specified';

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  ${googleFontLink}
  <style>
    @page { margin: 20px; }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: ${bodyFontFamily};
      color: #1a1a1a;
      line-height: 1.6;
      padding: 32px;
      max-width: 600px;
      margin: 0 auto;
      direction: ${bodyDirection};
    }

    /* Header */
    .header {
      text-align: center;
      padding-bottom: 20px;
      border-bottom: 3px solid #2E7D32;
      margin-bottom: 24px;
    }
    .header h1 {
      font-size: 22px;
      color: #2E7D32;
      font-weight: 700;
      margin-bottom: 4px;
    }
    .header .subtitle {
      font-size: 13px;
      color: #666;
    }

    /* Status badge */
    .status-bar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      background: ${isHealthy ? '#E8F5E9' : '#FFF3E0'};
      border: 1px solid ${statusColor};
      border-radius: 8px;
      padding: 14px 18px;
      margin-bottom: 20px;
    }
    .status-label {
      font-size: 18px;
      font-weight: 700;
      color: ${statusColor};
    }
    .status-confidence {
      font-size: 14px;
      color: #444;
    }

    /* Info row */
    .info-row {
      display: flex;
      justify-content: space-between;
      font-size: 12px;
      color: #555;
      margin-bottom: 20px;
    }
    .info-row span { display: block; }
    .info-label { font-weight: 600; color: #333; }

    /* Section */
    .section {
      margin-bottom: 18px;
    }
    .section h2 {
      font-size: 15px;
      font-weight: 700;
      color: #2E7D32;
      border-bottom: 1px solid #ddd;
      padding-bottom: 6px;
      margin-bottom: 10px;
    }
    .section p {
      font-size: 13px;
      color: #333;
      line-height: 1.7;
    }
    .section ul {
      padding-left: 20px;
      font-size: 13px;
      color: #333;
    }
    .section li {
      margin-bottom: 4px;
      line-height: 1.6;
    }

    /* Scanned image */
    .scan-image {
      text-align: center;
      margin: 16px 0 20px;
    }
    .scan-image img {
      max-width: 100%;
      max-height: 220px;
      border-radius: 8px;
      border: 1px solid #ddd;
    }

    /* Crop badge */
    .crop-badge {
      display: inline-block;
      background: #E8F5E9;
      color: #2E7D32;
      font-size: 12px;
      font-weight: 600;
      padding: 4px 12px;
      border-radius: 12px;
      margin-bottom: 16px;
    }

    /* Footer */
    .footer {
      margin-top: 32px;
      padding-top: 16px;
      border-top: 2px solid #ddd;
      text-align: center;
      font-size: 11px;
      color: #888;
    }
    .footer strong { color: #2E7D32; }

    /* Not a plant warning */
    .not-plant {
      text-align: center;
      padding: 40px 20px;
      background: #FFF3E0;
      border: 2px solid #FF9800;
      border-radius: 12px;
      margin: 40px 0;
    }
    .not-plant h2 {
      color: #E65100;
      font-size: 20px;
      border: none;
      margin-bottom: 12px;
    }
    .not-plant p {
      color: #666;
      font-size: 14px;
    }
  </style>
</head>
<body>
  <!-- Header -->
  <div class="header">
    <h1>Kissan Rehnuma</h1>
    <div class="subtitle">AI-Powered Crop Disease Diagnosis Report</div>
  </div>

  ${
    !d.is_positive
      ? `
  <div class="not-plant">
    <h2>Not a ${d.category_label} Image</h2>
    <p>${escapeHtml(d.message) || `The uploaded image does not appear to be a ${d.category_label.toLowerCase()}.`}</p>
    <p style="margin-top:12px;">Please upload a clear photo of a ${d.category_label.toLowerCase()} for disease analysis.</p>
  </div>
  `
      : `
  <!-- Status -->
  <div class="status-bar">
    <span class="status-label">${statusText}</span>
    <span class="status-confidence">Confidence: ${confidencePercent}%</span>
  </div>

  <!-- Meta info -->
  <div class="info-row">
    <span>
      <span class="info-label">Date:</span>
      ${dateStr} at ${timeStr}
    </span>
    <span>
      <span class="info-label">Scan ID:</span>
      ${escapeHtml((d.scan_id || 'unknown').substring(0, 8))}...
    </span>
  </div>

  ${d.image_url ? `<div class="scan-image"><img src="${escapeHtml(d.image_url)}" alt="Scanned image" /></div>` : ''}

  <!-- Disease name -->
  <div class="section">
    <h2>Diagnosis</h2>
    <p><strong>Disease:</strong> ${escapeHtml(d.disease_name || 'Unknown')}</p>
    ${d.scientific_name ? `<p><strong>Pathogen:</strong> ${escapeHtml(d.scientific_name)}</p>` : ''}
  </div>

  ${d.category_value ? `<span class="crop-badge">${d.category_label}: ${escapeHtml(d.category_value)}</span>` : ''}

  <!-- Symptoms -->
  <div class="section">
    <h2>Symptoms</h2>
    <ul>${symptomsHtml}</ul>
  </div>

  <!-- Causes -->
  <div class="section">
    <h2>Causes</h2>
    <p>${causesHtml}</p>
  </div>

  <!-- Treatment -->
  <div class="section">
    <h2>Treatment Recommendations</h2>
    <p>${treatmentHtml}</p>
  </div>

  <!-- Prevention -->
  <div class="section">
    <h2>Prevention Tips</h2>
    <ul>${preventionHtml}</ul>
  </div>

  <!-- Affected -->
  <div class="section">
    <h2>${d.affected_label}</h2>
    <p>${cropsHtml}</p>
  </div>

  ${d.message ? `
  <div class="section">
    <h2>Additional Notes</h2>
    <p>${escapeHtml(d.message)}</p>
  </div>
  ` : ''}
  `
  }

  <!-- Footer -->
  <div class="footer">
    <p>Generated by <strong>Kissan Rehnuma</strong> — AI Agricultural Assistant</p>
    <p>This report is for informational purposes only. Consult an agricultural expert for severe cases.</p>
  </div>
</body>
</html>`;
}

/**
 * Escape HTML special characters to prevent XSS in the PDF template.
 */
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// =========================================================
// Web PDF generation using pdf-lib (direct download, no print dialog)
// Pure JS, zero native dependencies, no html2canvas needed.
// =========================================================

/** Check if a string contains Arabic/Urdu/Sindhi script characters */
function hasRtlText(text: string): boolean {
  return /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/.test(text);
}

/** Check if any text in the report contains RTL characters */
function reportHasRtl(d: NormalizedReport): boolean {
  const texts = [
    d.disease_name, d.scientific_name, d.causes,
    d.treatment_recommendations, d.message,
    d.category_value, d.affected_value,
    ...d.symptoms, ...d.prevention_tips,
  ];
  return texts.some(t => t && hasRtlText(t));
}

async function generateWebPdf(data: DetectResponse | AnimalDetectResponse): Promise<void> {
  const d = normalizeReport(data);
  const { PDFDocument, rgb, StandardFonts } = await import('pdf-lib');

  const doc = await PDFDocument.create();

  const font = await doc.embedFont(StandardFonts.Helvetica);
  const boldFont = await doc.embedFont(StandardFonts.HelveticaBold);
  const italicFont = await doc.embedFont(StandardFonts.HelveticaOblique);

  // A4 page dimensions in points
  const PAGE_W = 595.28;
  const PAGE_H = 841.89;
  const MARGIN = 50;
  const CONTENT_W = PAGE_W - MARGIN * 2;
  const LINE_HEIGHT = 14;
  const SECTION_GAP = 8;

  // Colors
  const green = rgb(0.18, 0.49, 0.20); // #2E7D32
  const darkGray = rgb(0.2, 0.2, 0.2);
  const medGray = rgb(0.4, 0.4, 0.4);
  const lightGray = rgb(0.53, 0.53, 0.53);
  const orange = rgb(0.9, 0.32, 0);
  const white = rgb(1, 1, 1);
  const lightGreenBg = rgb(0.91, 0.96, 0.91); // #E8F5E9
  const lightOrangeBg = rgb(1, 0.95, 0.88); // #FFF3E0

  let page = doc.addPage([PAGE_W, PAGE_H]);
  let y = PAGE_H - MARGIN; // pdf-lib y starts from bottom

  // Helper: check if we need a new page
  const ensureSpace = (needed: number) => {
    if (y - needed < MARGIN) {
      page = doc.addPage([PAGE_W, PAGE_H]);
      y = PAGE_H - MARGIN;
    }
  };

  // Helper: wrap text into lines that fit within maxWidth
  const wrapText = (
    text: string,
    f: typeof font,
    size: number,
    maxW: number,
  ): string[] => {
    if (!text) return [];
    const words = text.split(/\s+/);
    const lines: string[] = [];
    let currentLine = '';

    for (const word of words) {
      const testLine = currentLine ? `${currentLine} ${word}` : word;
      const w = f.widthOfTextAtSize(testLine, size);
      if (w > maxW && currentLine) {
        lines.push(currentLine);
        currentLine = word;
      } else {
        currentLine = testLine;
      }
    }
    if (currentLine) lines.push(currentLine);
    return lines;
  };

  // Helper: draw wrapped text, returns new y position
  const drawWrappedText = (
    text: string,
    f: typeof font,
    size: number,
    color: typeof darkGray,
    indent: number = 0,
  ): number => {
    const lines = wrapText(text, f, size, CONTENT_W - indent);
    for (const line of lines) {
      ensureSpace(size + 4);
      page.drawText(line, {
        x: MARGIN + indent,
        y,
        size,
        font: f,
        color,
      });
      y -= size + 4;
    }
    return y;
  };

  // Helper: draw section heading with green underline
  const drawSectionHeading = (title: string) => {
    ensureSpace(28);
    y -= SECTION_GAP;
    page.drawText(title, {
      x: MARGIN,
      y,
      size: 13,
      font: boldFont,
      color: green,
    });
    y -= 4;
    page.drawLine({
      start: { x: MARGIN, y },
      end: { x: PAGE_W - MARGIN, y },
      thickness: 0.8,
      color: green,
    });
    y -= 14;
  };

  // Helper: draw bullet list
  const drawBulletList = (items: string[]) => {
    for (const item of items) {
      ensureSpace(LINE_HEIGHT + 4);
      page.drawText('\u2022', {
        x: MARGIN + 4,
        y,
        size: 10,
        font,
        color: darkGray,
      });
      drawWrappedText(item, font, 10, darkGray, 18);
      y -= 2;
    }
  };

  // ─── HEADER ───
  page.drawText('Kissan Rehnuma', {
    x: PAGE_W / 2 - boldFont.widthOfTextAtSize('Kissan Rehnuma', 22) / 2,
    y,
    size: 22,
    font: boldFont,
    color: green,
  });
  y -= 24;

  const subtitle = 'AI-Powered Crop Disease Diagnosis Report';
  page.drawText(subtitle, {
    x: PAGE_W / 2 - font.widthOfTextAtSize(subtitle, 10) / 2,
    y,
    size: 10,
    font,
    color: lightGray,
  });
  y -= 14;

  // Green line
  page.drawLine({
    start: { x: MARGIN, y },
    end: { x: PAGE_W - MARGIN, y },
    thickness: 2,
    color: green,
  });
  y -= 18;

  const now = new Date();
  const dateStr = now.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
  const timeStr = now.toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
  });
  const confidencePct =
    d.confidence != null ? (d.confidence * 100).toFixed(1) : null;

  // ─── NOT A POSITIVE SCAN ───
  if (!d.is_positive) {
    ensureSpace(60);
    // Orange box
    page.drawRectangle({
      x: MARGIN,
      y: y - 50,
      width: CONTENT_W,
      height: 55,
      color: lightOrangeBg,
      borderColor: orange,
      borderWidth: 1.5,
    });
    const warnTitle = 'Not a Plant Image';
    page.drawText(warnTitle, {
      x: PAGE_W / 2 - boldFont.widthOfTextAtSize(warnTitle, 16) / 2,
      y: y - 18,
      size: 16,
      font: boldFont,
      color: orange,
    });
    const msg = d.message || `The uploaded image does not appear to be a ${d.category_label.toLowerCase()}.`;
    drawWrappedText(msg, font, 10, medGray, 0);
    y -= 60;
  } else {
    const isHealthy = d.disease_name?.toLowerCase() === 'healthy';
    // ─── STATUS BADGE ───
    ensureSpace(30);
    const statusBg = isHealthy ? lightGreenBg : lightOrangeBg;
    const statusColor = isHealthy ? green : orange;
    page.drawRectangle({
      x: MARGIN,
      y: y - 22,
      width: CONTENT_W,
      height: 28,
      color: statusBg,
    });
    page.drawText(isHealthy ? 'Healthy' : 'Disease Detected', {
      x: MARGIN + 8,
      y: y - 14,
      size: 12,
      font: boldFont,
      color: statusColor,
    });
    if (confidencePct) {
      const confText = `Confidence: ${confidencePct}%`;
      page.drawText(confText, {
        x: PAGE_W - MARGIN - font.widthOfTextAtSize(confText, 10) - 8,
        y: y - 13,
        size: 10,
        font,
        color: medGray,
      });
    }
    y -= 36;

    // ─── META INFO ───
    ensureSpace(14);
    page.drawText(`Date: ${dateStr} at ${timeStr}`, {
      x: MARGIN,
      y,
      size: 9,
      font,
      color: medGray,
    });
    const scanIdText = `Scan ID: ${(d.scan_id || 'unknown').substring(0, 8)}...`;
    page.drawText(scanIdText, {
      x: PAGE_W - MARGIN - font.widthOfTextAtSize(scanIdText, 9),
      y,
      size: 9,
      font,
      color: medGray,
    });
    y -= 16;

    // ─── SCANNED IMAGE ───
    if (d.image_url) {
      try {
        const imgResp = await fetch(d.image_url);
        if (imgResp.ok) {
          const imgBytes = await imgResp.arrayBuffer();
          const contentType = imgResp.headers.get('content-type') || '';
          let embeddedImage;
          if (contentType.includes('png') || imgBytes.byteLength > 0) {
            try {
              embeddedImage = await doc.embedPng(imgBytes);
            } catch {
              try {
                embeddedImage = await doc.embedJpg(imgBytes);
              } catch {
                // Image format not supported — skip silently
              }
            }
          }
          if (embeddedImage) {
            // Scale to fit within CONTENT_W, max height 200pt
            const MAX_IMG_W = CONTENT_W;
            const MAX_IMG_H = 200;
            const imgW = embeddedImage.width;
            const imgH = embeddedImage.height;
            const scaleW = MAX_IMG_W / imgW;
            const scaleH = MAX_IMG_H / imgH;
            const scale = Math.min(scaleW, scaleH, 1); // never upscale
            const drawW = imgW * scale;
            const drawH = imgH * scale;

            ensureSpace(drawH + 20);
            // Center the image
            const imgX = MARGIN + (CONTENT_W - drawW) / 2;
            page.drawImage(embeddedImage, {
              x: imgX,
              y: y - drawH,
              width: drawW,
              height: drawH,
            });
            y -= drawH + 10;
          }
        }
      } catch {
        // Image fetch failed — skip silently, rest of report still works
      }
    }

    // ─── DIAGNOSIS ───
    drawSectionHeading('Diagnosis');
    drawWrappedText(`Disease: ${d.disease_name || 'Unknown'}`, boldFont, 11, darkGray);
    y -= 2;
    if (d.scientific_name) {
      drawWrappedText(`Pathogen: ${d.scientific_name}`, font, 10, darkGray);
    }
    if (d.category_value) {
      ensureSpace(16);
      // Category badge background
      const badgeText = `${d.category_label}: ${d.category_value}`;
      const badgeW = boldFont.widthOfTextAtSize(badgeText, 9) + 12;
      page.drawRectangle({
        x: MARGIN,
        y: y - 4,
        width: badgeW,
        height: 16,
        color: lightGreenBg,
      });
      page.drawText(badgeText, {
        x: MARGIN + 6,
        y: y + 1,
        size: 9,
        font: boldFont,
        color: green,
      });
      y -= 20;
    }

    // ─── SYMPTOMS ───
    drawSectionHeading('Symptoms');
    if (d.symptoms && d.symptoms.length > 0) {
      drawBulletList(d.symptoms);
    } else {
      drawWrappedText('No symptoms reported.', italicFont, 10, lightGray);
    }

    // ─── CAUSES ───
    drawSectionHeading('Causes');
    drawWrappedText(d.causes || 'No causes information available.', font, 10, darkGray);

    // ─── TREATMENT ───
    drawSectionHeading('Treatment Recommendations');
    drawWrappedText(
      d.treatment_recommendations || 'No treatment recommendations available.',
      font,
      10,
      darkGray,
    );

    // ─── PREVENTION ───
    drawSectionHeading('Prevention Tips');
    if (d.prevention_tips && d.prevention_tips.length > 0) {
      drawBulletList(d.prevention_tips);
    } else {
      drawWrappedText('No prevention tips available.', italicFont, 10, lightGray);
    }

    // ─── AFFECTED ───
    drawSectionHeading(d.affected_label);
    drawWrappedText(d.affected_value || 'Not specified', font, 10, darkGray);

    // ─── ADDITIONAL NOTES ───
    if (d.message) {
      drawSectionHeading('Additional Notes');
      drawWrappedText(d.message, font, 10, darkGray);
    }
  }

  // ─── FOOTER ───
  ensureSpace(40);
  y -= 16;
  page.drawLine({
    start: { x: MARGIN, y },
    end: { x: PAGE_W - MARGIN, y },
    thickness: 0.5,
    color: rgb(0.78, 0.78, 0.78),
  });
  y -= 14;
  const footerLine1 = 'Generated by Kissan Rehnuma — AI Agricultural Assistant';
  page.drawText(footerLine1, {
    x: PAGE_W / 2 - boldFont.widthOfTextAtSize(footerLine1, 9) / 2,
    y,
    size: 9,
    font: boldFont,
    color: green,
  });
  y -= 14;
  const footerLine2 = 'This report is for informational purposes only. Consult an agricultural expert for severe cases.';
  page.drawText(footerLine2, {
    x: PAGE_W / 2 - font.widthOfTextAtSize(footerLine2, 8) / 2,
    y,
    size: 8,
    font,
    color: lightGray,
  });

  // ─── SAVE / DOWNLOAD ───
  const pdfBytes = await doc.save();
  const blob = new Blob([new Uint8Array(pdfBytes) as unknown as BlobPart], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `KissanRehnuma_Report_${(d.scan_id || 'report').substring(0, 8)}.pdf`;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}

// =========================================================
// Web RTL PDF — browser native rendering for Urdu/Sindhi.
// Opens HTML report in a new tab and triggers the print dialog.
// The browser's rendering engine handles Arabic text shaping
// perfectly (connected letters, proper RTL layout).
// User clicks "Save as PDF" in the print dialog to download.
// =========================================================

async function generateWebRtlPdf(data: DetectResponse | AnimalDetectResponse): Promise<void> {
  const html = buildReportHtml(data);
  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    // Popup blocked — open as blob URL instead
    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank');
    URL.revokeObjectURL(url);
    return;
  }
  printWindow.document.write(html);
  printWindow.document.close();
  // Wait for fonts and images to load, then trigger print
  printWindow.addEventListener('load', () => {
    setTimeout(() => printWindow.print(), 500);
  });
}

// =========================================================
// Public API
// =========================================================

export const pdfService = {
  /**
   * Generate a PDF report and trigger download/share.
   *
   * Web: jsPDF generates PDF → doc.save() → direct browser download (no print dialog)
   * Native: expo-print generates PDF → expo-sharing → native share sheet
   *
   * @param data - The DetectResponse (or HistoryItem) from crop disease scan
   */
  async generateAndShareReport(data: DetectResponse | AnimalDetectResponse): Promise<void> {
    if (Platform.OS === 'web') {
      const d = normalizeReport(data);
      if (reportHasRtl(d)) {
        // Urdu/Sindhi: browser native HTML rendering (perfect Arabic text shaping)
        await generateWebRtlPdf(data);
      } else {
        // English: pdf-lib direct download
        await generateWebPdf(data);
      }
    } else {
      // Native: HTML → PDF via expo-print → share via expo-sharing
      const html = buildReportHtml(data);
      const { uri } = await Print.printToFileAsync({ html });
      await shareAsync(uri, {
        UTI: '.pdf',
        mimeType: 'application/pdf',
      });
    }
  },
};
