export function svgToDataURL(svg: string) {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

export function createSVGIcon(text: string) {
  // Calculate width based on text length - make it bigger like before
  const digitCount = text.length;
  const baseWidth = 18; // Larger base width to match original size
  const width = Math.max(baseWidth, digitCount * 10); // More pixels per digit

  // Fixed square viewBox large enough for any reasonable cluster count
  const viewBoxSize = 60; // Larger viewBox to accommodate bigger rectangles
  const centerX = viewBoxSize / 2;
  const centerY = viewBoxSize / 2;
  const rectHeight = 18; // Larger height to match original proportions
  const rectX = centerX - width / 2;
  const rectY = centerY - rectHeight / 2;

  return `
    <svg width="480" height="480" viewBox="0 0 ${viewBoxSize} ${viewBoxSize}" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="${rectX}" y="${rectY}" width="${width}" height="${rectHeight}" rx="9" fill="#FDE047"/>
      <rect x="${rectX}" y="${rectY}" width="${width}" height="${rectHeight}" rx="9" stroke="white"/>
    </svg>
  `;
}
