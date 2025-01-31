export function svgToDataURL(svg: string) {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

export function createSVGIcon(text: string) {
  // Calculate width based on text length
  const digitCount = text.length;
  const baseWidth = 9; // Width for single digit
  const width = Math.max(baseWidth, digitCount * 5); // 7 pixels per digit
  const viewBoxWidth = width + 1; // Add 1 for padding

  return `
    <svg width="480" height="480" viewBox="0 0 ${viewBoxWidth} 15" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="0.5" y="0.500004" width="${width}" height="9" rx="4.5" fill="#FDE047"/>
      <rect x="0.5" y="0.500004" width="${width}" height="9" rx="4.5" stroke="white"/>
    </svg>
  `;
}
