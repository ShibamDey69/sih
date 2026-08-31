import path from 'path';
import { fileURLToPath } from 'url';
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';
import { createCanvas } from '@napi-rs/canvas';
import sharp from 'sharp';
import Tesseract from 'tesseract.js';
import { extractEntitiesFromText } from '../utils/regexExtractors.js';
import { logger } from '../utils/logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const standardFontsPath = path.resolve(__dirname, '../../node_modules/pdfjs-dist/standard_fonts/').replace(/\\/g, '/') + '/';
const cMapsPath = path.resolve(__dirname, '../../node_modules/pdfjs-dist/cmaps/').replace(/\\/g, '/') + '/';


export const pageImageCache = new Map();

export class OcrEntityService {
  
  static async processDocumentOcr(fileContent, mimeType = '', originalName = '', options = {}) {
    const startTime = Date.now();
    logger.info('OCR_PIPELINE', `Initiating high-accuracy OCR extraction for "${originalName}" (MIME: ${mimeType})`);

    const docId = options.docId || `temp-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const includePageImages = options.includePageImages !== false; 

    
    if (typeof fileContent === 'string') {
      const extractedText = fileContent.trim();
      const extractedEntities = extractEntitiesFromText(extractedText);
      return {
        ocrText: extractedText,
        pages: [
          {
            pageNumber: 1,
            text: extractedText,
            confidence: 100.0,
            wordCount: extractedText.split(/\s+/).filter(Boolean).length,
            status: 'SUCCESS',
            imageBase64: null,
            imageUrl: null,
            error: null,
          },
        ],
        pageCount: 1,
        successfulPages: 1,
        failedPages: 0,
        confidence: 100.0,
        entities: extractedEntities,
        ocrEngine: 'Direct String Parser',
        status: 'SUCCESS',
        processingTimeMs: Date.now() - startTime,
      };
    }

    if (!Buffer.isBuffer(fileContent)) {
      throw new Error('Invalid file content: Expected Buffer or String.');
    }

    if (fileContent.length === 0) {
      throw new Error('Uploaded document is empty (0 bytes).');
    }

    
    const isPdf =
      /application\/pdf/i.test(mimeType) ||
      /\.pdf$/i.test(originalName) ||
      fileContent.slice(0, 10).toString('ascii').includes('%PDF-');

    
    const isImage =
      /image\/(png|jpeg|jpg|webp|tiff|bmp)/i.test(mimeType) ||
      /\.(png|jpe?g|webp|tiff|bmp)$/i.test(originalName);

    if (isPdf) {
      return await this._processPdfPipeline(fileContent, originalName, {
        docId,
        includePageImages,
        startTime,
      });
    } else if (isImage) {
      return await this._processImagePipeline(fileContent, originalName, mimeType, {
        docId,
        includePageImages,
        startTime,
      });
    } else {
     
      const utf8Str = fileContent.toString('utf8');
      const isPrintable = /^[\x20-\x7E\s\n\r\t]+$/.test(utf8Str.substring(0, Math.min(utf8Str.length, 300)));

      if (isPrintable && utf8Str.trim().length > 0) {
        const cleanText = utf8Str.trim();
        const entities = extractEntitiesFromText(cleanText);
        return {
          ocrText: cleanText,
          pages: [
            {
              pageNumber: 1,
              text: cleanText,
              confidence: 100.0,
              wordCount: cleanText.split(/\s+/).filter(Boolean).length,
              status: 'SUCCESS',
              imageBase64: null,
              imageUrl: null,
              error: null,
            },
          ],
          pageCount: 1,
          successfulPages: 1,
          failedPages: 0,
          confidence: 100.0,
          entities,
          ocrEngine: 'UTF-8 Text Ingestion',
          status: 'SUCCESS',
          processingTimeMs: Date.now() - startTime,
        };
      } else {
        throw new Error(`Unsupported or unreadable file format "${originalName}" (${mimeType}). Please upload a valid PDF or Image document.`);
      }
    }
  }

  
  static async _processPdfPipeline(pdfBuffer, originalName, options) {
    const { docId, includePageImages, startTime } = options;

    logger.info('PDF_PIPELINE', `Processing PDF "${originalName}" (${pdfBuffer.length} bytes)...`);

   
    const headerSlice = pdfBuffer.slice(0, 1024).toString('latin1');
    if (!headerSlice.includes('%PDF-')) {
      throw new Error('Corrupted or invalid PDF: Missing %PDF header identification bytes.');
    }

    let pdfDoc;
    try {
      const loadingTask = pdfjsLib.getDocument({
        data: new Uint8Array(pdfBuffer),
        cMapUrl: cMapsPath,
        cMapPacked: true,
        standardFontDataUrl: standardFontsPath,
        disableFontFace: true, 
        useSystemFonts: true,
        stopAtErrors: false,
      });
      pdfDoc = await loadingTask.promise;
    } catch (loadErr) {
      logger.error('PDF_PIPELINE', 'Failed to load and parse PDF document', loadErr);
      throw new Error(`Corrupted PDF document: Unable to parse PDF structure (${loadErr.message}).`);
    }

    const numPages = pdfDoc.numPages;
    if (numPages === 0) {
      throw new Error('PDF document contains 0 pages.');
    }

    logger.info('PDF_PIPELINE', `PDF loaded successfully. Total pages: ${numPages}`);

    const pages = [];
    let totalConfidenceSum = 0;
    let confidencePageCount = 0;

    for (let pageNum = 1; pageNum <= numPages; pageNum++) {
      const pageStartTime = Date.now();

      try {
        const page = await pdfDoc.getPage(pageNum);

       
        let nativePageText = '';
        try {
          const textContent = await page.getTextContent();
          if (textContent && Array.isArray(textContent.items) && textContent.items.length > 0) {
            
            nativePageText = textContent.items
              .map((item) => item.str || '')
              .filter(Boolean)
              .join(' ')
              .replace(/\s+/g, ' ')
              .trim();
          }
        } catch (textExtractErr) {
          logger.warn('PDF_PIPELINE', `Native text extraction notice on page ${pageNum}:`, textExtractErr.message);
        }

       
        const baseViewport = page.getViewport({ scale: 1.0 });
        const targetWidth = 2400; // 300 DPI width for standard A4
        const renderScale = Math.max(3.0, Math.min(4.5, targetWidth / (baseViewport.width || 595)));
        const viewport = page.getViewport({ scale: renderScale });

        const canvasWidth = Math.floor(viewport.width);
        const canvasHeight = Math.floor(viewport.height);

       
        const canvas = createCanvas(canvasWidth, canvasHeight);
        const ctx = canvas.getContext('2d');

       
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvasWidth, canvasHeight);

        const renderContext = {
          canvasContext: ctx,
          viewport,
        };

        await page.render(renderContext).promise;

       
        const rawPngBuffer = canvas.toBuffer('image/png');

       
        const cacheKey = `${docId}_page_${pageNum}`;
        pageImageCache.set(cacheKey, {
          buffer: rawPngBuffer,
          mimeType: 'image/png',
          timestamp: Date.now(),
        });

       
        const imageUrl = `/api/documents/page-image?key=${encodeURIComponent(cacheKey)}`;
        let imageBase64 = null;
        if (includePageImages) {
         
          const previewBuffer = await sharp(rawPngBuffer)
            .resize({ width: 1200, withoutEnlargement: true })
            .png({ quality: 80, compressionLevel: 6 })
            .toBuffer();
          imageBase64 = `data:image/png;base64,${previewBuffer.toString('base64')}`;
        }

        
        let pageText = '';
        let pageConfidence = 95.0;

        
        const hasSubstantialNativeText =
          nativePageText.length > 35 && /[a-zA-Z0-9\u0900-\u097F]{4,}/.test(nativePageText);

        if (hasSubstantialNativeText) {
         
          pageText = nativePageText;
          pageConfidence = 98.5;
          logger.info('PDF_PIPELINE', `Page ${pageNum}/${numPages} extracted via Native Vector Layer (${pageText.length} chars)`);
        } else {
         
          logger.info('PDF_PIPELINE', `Page ${pageNum}/${numPages} running High-Res Tesseract OCR (300 DPI)...`);

         
          const ocrImageBuffer = await sharp(rawPngBuffer)
            .grayscale()
            .png()
            .toBuffer();

          const ocrResult = await Tesseract.recognize(ocrImageBuffer, 'eng', {
            errorHandler: (err) => logger.warn('TESSERACT_WORKER', `Page ${pageNum} event:`, err),
          });

          pageText = ocrResult?.data?.text ? ocrResult.data.text.trim() : '';
          const rawConf = ocrResult?.data?.confidence != null ? Number(ocrResult.data.confidence) : 0;
          pageConfidence = Math.round(rawConf * 10) / 10;

          
          if (pageText.length < 15 && nativePageText.length > pageText.length) {
            pageText = nativePageText;
            pageConfidence = 85.0;
          }

          logger.info(
            'PDF_PIPELINE',
            `Page ${pageNum}/${numPages} OCR completed in ${Date.now() - pageStartTime}ms with ${pageConfidence}% confidence (${pageText.length} chars)`
          );
        }

        if (pageText.length > 0) {
          totalConfidenceSum += pageConfidence;
          confidencePageCount++;
        }

        pages.push({
          pageNumber: pageNum,
          text: pageText,
          confidence: pageConfidence,
          wordCount: pageText ? pageText.split(/\s+/).filter(Boolean).length : 0,
          characterCount: pageText.length,
          dimensions: {
            width: canvasWidth,
            height: canvasHeight,
            originalWidth: Math.round(viewport.width / renderScale),
            originalHeight: Math.round(viewport.height / renderScale),
          },
          status: 'SUCCESS',
          imageBase64,
          imageUrl,
          error: null,
        });
      } catch (pageErr) {
        logger.error('PDF_PIPELINE', `Failed to render or OCR page ${pageNum}/${numPages}`, pageErr);
        pages.push({
          pageNumber: pageNum,
          text: '',
          confidence: 0,
          wordCount: 0,
          characterCount: 0,
          dimensions: null,
          status: 'ERROR',
          imageBase64: null,
          imageUrl: null,
          error: `Page ${pageNum} processing error: ${pageErr.message}`,
        });
      }
    }

   
    const successfulPages = pages.filter((p) => p.status === 'SUCCESS');
    const combinedText = pages
      .map((p) => {
        if (p.status === 'ERROR') {
          return `--- [Page ${p.pageNumber}: Processing Failed] ---`;
        }
        if (!p.text) {
          return `--- [Page ${p.pageNumber}: No Text Detected] ---`;
        }
        return numPages > 1 ? `--- [Page ${p.pageNumber}] ---\n${p.text}` : p.text;
      })
      .join('\n\n');

   
    const overallConfidence =
      confidencePageCount > 0
        ? Math.round((totalConfidenceSum / confidencePageCount) * 10) / 10
        : 0;

    
    const extractedEntities = extractEntitiesFromText(combinedText);

    logger.info(
      'PDF_PIPELINE',
      `Full PDF OCR Pipeline Complete: Processed ${numPages} pages in ${Date.now() - startTime}ms. Overall Confidence: ${overallConfidence}%`
    );

    return {
      ocrText: combinedText,
      pages,
      pageCount: numPages,
      successfulPages: successfulPages.length,
      failedPages: pages.length - successfulPages.length,
      confidence: overallConfidence,
      entities: extractedEntities,
      ocrEngine: 'Mozilla PDF.js -> 300 DPI Canvas -> Tesseract.js LSTM',
      status: successfulPages.length > 0 ? 'SUCCESS' : 'FAILED',
      processingTimeMs: Date.now() - startTime,
    };
  }

  
  static async _processImagePipeline(imageBuffer, originalName, mimeType, options) {
    const { docId, includePageImages, startTime } = options;

    logger.info('IMAGE_PIPELINE', `Processing Direct Image "${originalName}" (${imageBuffer.length} bytes)...`);

    try {
      const metadata = await sharp(imageBuffer).metadata();

      const preprocessedBuffer = await sharp(imageBuffer)
        .grayscale()
        .png()
        .toBuffer();

      const cacheKey = `${docId}_page_1`;
      pageImageCache.set(cacheKey, {
        buffer: imageBuffer,
        mimeType: mimeType || 'image/png',
        timestamp: Date.now(),
      });

      const imageUrl = `/api/documents/page-image?key=${encodeURIComponent(cacheKey)}`;
      let imageBase64 = null;
      if (includePageImages) {
        const previewBuffer = await sharp(imageBuffer)
          .resize({ width: 1200, withoutEnlargement: true })
          .png({ quality: 80 })
          .toBuffer();
        imageBase64 = `data:image/png;base64,${previewBuffer.toString('base64')}`;
      }

      const ocrResult = await Tesseract.recognize(preprocessedBuffer, 'eng', {
        errorHandler: (err) => logger.warn('TESSERACT_WORKER', 'Image event:', err),
      });

      const extractedText = ocrResult?.data?.text ? ocrResult.data.text.trim() : '';
      const confidence = ocrResult?.data?.confidence != null ? Math.round(ocrResult.data.confidence * 10) / 10 : 0;

      const entities = extractEntitiesFromText(extractedText);

      return {
        ocrText: extractedText,
        pages: [
          {
            pageNumber: 1,
            text: extractedText,
            confidence,
            wordCount: extractedText ? extractedText.split(/\s+/).filter(Boolean).length : 0,
            characterCount: extractedText.length,
            dimensions: {
              width: metadata.width || 0,
              height: metadata.height || 0,
            },
            status: 'SUCCESS',
            imageBase64,
            imageUrl,
            error: null,
          },
        ],
        pageCount: 1,
        successfulPages: 1,
        failedPages: 0,
        confidence,
        entities,
        ocrEngine: 'Sharp Grayscale -> Tesseract.js (eng)',
        status: 'SUCCESS',
        processingTimeMs: Date.now() - startTime,
      };
    } catch (err) {
      logger.error('IMAGE_PIPELINE', 'Fatal Image OCR error', err);
      throw new Error(`Failed to process image "${originalName}": ${err.message}`);
    }
  }
}
