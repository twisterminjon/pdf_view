import React, { useState, useRef, useEffect } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import { Reference, TextItem } from '../../types';
import { references } from '../../constants/references';

// Configure PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url
).toString();

const PDFJSViewer: React.FC = () => {
  const [numPages, setNumPages] = useState<number>(0);
  const [searchText, setSearchText] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const canvasRefs = useRef<(HTMLCanvasElement | null)[]>([]);
  const pdfDocRef = useRef<pdfjsLib.PDFDocumentProxy | null>(null);
  const [highlights, setHighlights] = useState<
    {
      pageIndex: number;
      rects: DOMRect[];
    }[]
  >([]);

  // Base PDF page rendering
  const renderPage = async (pageNum: number) => {
    if (!pdfDocRef.current) return;
    const page = await pdfDocRef.current.getPage(pageNum);
    const canvas = canvasRefs.current[pageNum - 1];
    if (!canvas) return;

    const viewport = page.getViewport({ scale: 1.5 });
    canvas.height = viewport.height;
    canvas.width = viewport.width;

    await page.render({
      canvasContext: canvas.getContext('2d')!,
      viewport: viewport,
    }).promise;
  };

  // Initialize PDF
  useEffect(() => {
    const loadPDF = async () => {
      try {
        const pdf = await pdfjsLib.getDocument(
          '/wa-cigna-dental-preventive-policy.pdf'
        ).promise;
        pdfDocRef.current = pdf;
        setNumPages(pdf.numPages);
        canvasRefs.current = Array(pdf.numPages).fill(null);

        for (let i = 1; i <= pdf.numPages; i++) {
          await renderPage(i);
        }
        setIsLoading(false);
      } catch (error) {
        console.error('Error loading PDF:', error);
        setIsLoading(false);
      }
    };

    loadPDF();
  }, []);

  const handleReferenceClick = async (reference: Reference) => {
    try {
      setIsLoading(true);
      if (!pdfDocRef.current) return;

      const newHighlights: { pageIndex: number; rects: DOMRect[] }[] = [];

      for (let pageIndex = 1; pageIndex <= numPages; pageIndex++) {
        const page = await pdfDocRef.current.getPage(pageIndex);
        const viewport = page.getViewport({ scale: 1.5 });
        const pageHighlights = await renderHighlights(
          page,
          viewport,
          pageIndex,
          reference.content
        );

        if (pageHighlights.length > 0) {
          newHighlights.push({ pageIndex, rects: pageHighlights });
          const pageElement = document.querySelector(`#page-${pageIndex}`);
          pageElement?.scrollIntoView({ behavior: 'smooth', block: 'start' });
          break;
        }
      }

      setSearchText(reference.content);
      setHighlights(newHighlights);
    } catch (error) {
      console.error('Error handling reference click:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Render highlights for text search
  const renderHighlights = async (
    page: pdfjsLib.PDFPageProxy,
    viewport: pdfjsLib.PageViewport,
    pageIndex: number,
    searchValue: string = searchText
  ) => {
    const textContent = await page.getTextContent();
    const pageHighlights: DOMRect[] = [];

    // Store found text parts with their PDF items
    const searchTextPartItems: { text: string; item: TextItem }[] = [];
    const remainingSearch = searchValue;

    // Find text sequences in PDF content
    for (let i = 0; i < textContent.items.length; i++) {
      const item = textContent.items[i];
      const text = 'str' in item ? item.str : '';
      if (!text.trim()) continue;

      if (remainingSearch.startsWith(text)) {
        searchTextPartItems.push({ text, item: item as TextItem });
        let currentRemainingSearch = remainingSearch.slice(text.length).trim();

        let j = i + 1;
        let sequenceValid = true;

        // Look for continuation of the sequence
        while (
          j < textContent.items.length &&
          currentRemainingSearch.length > 0
        ) {
          const nextItem = textContent.items[j];
          const nextText = 'str' in nextItem ? nextItem.str : '';

          if (
            currentRemainingSearch.startsWith(nextText) ||
            nextText.includes(currentRemainingSearch)
          ) {
            searchTextPartItems.push({
              text: nextText,
              item: nextItem as TextItem,
            });
            currentRemainingSearch = nextText.includes(currentRemainingSearch)
              ? ''
              : currentRemainingSearch.slice(nextText.length).trim();
            j++;
          } else {
            searchTextPartItems.length = 0;
            sequenceValid = false;
            break;
          }
        }

        if (sequenceValid && currentRemainingSearch.length === 0) {
          break;
        }
      }
    }

    // Calculate highlight rectangles for found text
    searchTextPartItems.forEach(({ item }) => {
      const transform = item.transform;
      const canvas = canvasRefs.current[pageIndex - 1];
      if (!canvas) return;

      const containerWidth = canvas.clientWidth;
      const containerHeight = canvas.clientHeight;
      const scaleX = containerWidth / canvas.width;
      const scaleY = containerHeight / canvas.height;

      const fontSize = Math.sqrt(
        transform[0] * transform[0] + transform[1] * transform[1]
      );
      const textWidth = item.width;
      const textHeight = fontSize;

      const [pdfX, pdfY] = viewport.convertToViewportPoint(
        transform[4],
        transform[5]
      );

      const x = pdfX * scaleX;
      const y = pdfY * scaleY;
      const scaledWidth = textWidth * viewport.scale * scaleX;
      const scaledHeight = textHeight * viewport.scale * scaleY;

      const padding = 2 * Math.min(scaleX, scaleY);

      pageHighlights.push(
        new DOMRect(
          x - padding,
          y - scaledHeight - padding,
          scaledWidth + padding * 2,
          scaledHeight + padding * 2
        )
      );
    });

    return pageHighlights;
  };

  return (
    <div className="pdf-viewer">
      <div className="pdf-container">
        {isLoading && (
          <div className="loading-overlay">
            <div className="loading-spinner">Loading...</div>
          </div>
        )}
        {Array.from({ length: numPages }, (_, i) => (
          <div key={i} id={`page-${i + 1}`} className="page-container">
            <canvas
              ref={(el) => {
                canvasRefs.current[i] = el;
              }}
              className="pdf-canvas"
            />
            {highlights
              .filter((h) => h.pageIndex === i + 1)
              .map((highlight, highlightIndex) => (
                <div key={highlightIndex} className="highlight-layer">
                  {highlight.rects.map((rect, rectIndex) => (
                    <div
                      key={rectIndex}
                      className="highlight"
                      style={{
                        position: 'absolute',
                        left: `${rect.x}px`,
                        top: `${rect.y}px`,
                        width: `${rect.width}px`,
                        height: `${rect.height}px`,
                        backgroundColor: 'rgba(255, 255, 0, 0.3)',
                        pointerEvents: 'none',
                      }}
                    />
                  ))}
                </div>
              ))}
          </div>
        ))}
      </div>
      <div className="sidebar">
        {references.map((reference, index) => (
          <button
            key={index}
            onClick={() => handleReferenceClick(reference)}
            className="reference-button"
            disabled={isLoading}
          >
            {reference.content.substring(0, 50)}...
          </button>
        ))}
      </div>
    </div>
  );
};

export default PDFJSViewer;
