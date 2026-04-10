import { LayerExtension } from "@deck.gl/core";

const fs = `\
#version 300 es
#define SHADER_NAME text-background-layer-fragment-shader

precision highp float;

in vec4 vFillColor;
in vec4 vLineColor;
in float vLineWidth;
in vec2 uv;
in vec2 dimensions;

out vec4 fragColor;

float round_rect(vec2 p, vec2 size, vec4 radii) {
    // from https://www.shadertoy.com/view/4llXD7
    radii.xy = (p.x>0.0)?radii.xy : radii.zw;
    radii.x  = (p.y>0.0)?radii.x  : radii.y;
    vec2 q = abs(p)-size+radii.x;
    return min(max(q.x,q.y),0.0) + length(max(q,0.0)) - radii.x;
}

void main(void) {
  geometry.uv = uv;

  // Convert UV to center-based coordinates [-0.5, 0.5]
  vec2 pixelPosition = (uv - 0.5) * dimensions;

  float maxBorderRadius = min(dimensions.x, dimensions.y) * 0.5;
  vec4 borderRadius = vec4(min(20.0, maxBorderRadius)); // 20px border radius
  float dist = round_rect(pixelPosition, dimensions * 0.5, borderRadius);

  // Discard pixels outside the rounded rect
  if (dist > 1.0) {
    discard;
  }

  // Border Calculation - check vLineWidth directly for border
  if (vLineWidth > 0.0) {
    float distToEdge = -dist;
    float isBorder = smoothstep(vLineWidth - 1.0, vLineWidth + 1.0, distToEdge);
    fragColor = mix(vLineColor, vFillColor, isBorder);
  } else {
    fragColor = vFillColor;
  }

  // Smooth transition for the main shape
  float shapeAlpha = smoothstep(1.0, -1.0, dist);
  fragColor.a *= shapeAlpha;

  DECKGL_FILTER_COLOR(fragColor, geometry);
}
`;

export class BorderRadiusExtension extends LayerExtension {
  static extensionName = "BorderRadiusExtension";

  getShaders() {
    return {
      fs,
    };
  }
}
