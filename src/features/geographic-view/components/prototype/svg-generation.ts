type PinFace = {
  face: string;
  main_color: string;
};

// Cache the SVG templates
const SVG_TEMPLATE = `<svg width="300" height="500" viewBox="0 0 30 50" fill="none" xmlns="http://www.w3.org/2000/svg"><defs><style>@import url('https://fonts.googleapis.com/css2?family=Inter:wght@500&amp;display=swap');.text{font-family:'Inter',sans-serif;font-weight:500;}.small{font:7px sans-serif;fill:black;}</style></defs>`;

// Cache the background paths
const BACKGROUND_PATHS = {
  background: `<path d="M12.5659 3.82117C13.7014 1.99485 16.2986 1.99485 17.4341 3.82117C21.6666 10.6285 29.935 24.7203 29.935 30.918C29.935 39.2476 23.2484 46 15 46C6.75161 46 0.0649697 39.2476 0.0649693 30.918C0.0649691 24.7203 8.33343 10.6285 12.5659 3.82117Z" fill="white"/>`,
  innerColor: (color: string) =>
    `<path d="M12.5504 11.5877C13.6671 9.7146 16.3079 9.71461 17.4245 11.5877C20.6413 16.9833 25.9015 26.4695 25.9015 30.8041C25.9015 37.0478 21.0151 42.1094 14.9875 42.1094C8.95984 42.1094 4.07347 37.0478 4.07347 30.8041C4.07347 26.4695 9.3337 16.9833 12.5504 11.5877Z" fill="${color}"/>`,
  outerLine: (color: string) =>
    `<path d="M17.0183 5.50805C19.0142 8.80935 21.8789 13.7421 24.243 18.5737C25.4252 20.9898 26.4782 23.3723 27.2345 25.5078C27.9948 27.6542 28.4394 29.5076 28.4394 30.8804C28.4394 38.588 22.4064 44.8066 15.0001 44.8066C7.59374 44.8066 1.56069 38.588 1.56069 30.8804C1.56069 29.5076 2.00528 27.6542 2.76557 25.5078C3.52195 23.3723 4.5749 20.9898 5.75709 18.5737C8.12119 13.7421 10.9859 8.80935 12.9818 5.50805C13.915 3.9646 16.0851 3.9646 17.0183 5.50805Z" stroke="${color}"/>`,
};

const disconnected_pin = {
  face: `<ellipse cx="15" cy="34.4185" rx="1.47385" ry="1.92163" fill="white"/>
<path d="M8.6131 29.8068L8.8476 30.0487C10.0134 31.2516 11.9386 31.2667 13.1231 30.0821L13.3985 29.8068" stroke="white" stroke-linecap="round"/>
<path d="M16.6015 29.8068L16.8359 30.0487C18.0018 31.2516 19.9269 31.2667 21.1115 30.0821L21.3869 29.8068" stroke="white" stroke-linecap="round"/>`,
  main_color: "#6B7280",
};

// Cache the face paths
const PinState: Record<string, PinFace> = {
  Happy: {
    face: `<path d="M11.9197 32.8969C11.9197 32.8969 11.9486 35.8969 15.0145 35.8969C18.0804 35.8969 18.0804 32.8969 18.0804 32.8969" stroke="white" stroke-linecap="round"/><ellipse cx="11.1496" cy="28.3969" rx="2.31026" ry="2.25" fill="white"/><ellipse cx="18.8505" cy="28.3969" rx="2.31026" ry="2.25" fill="white"/>`,
    main_color: "#3B82F6",
  },
  Serious: {
    face: `<ellipse cx="11.1496" cy="28.3969" rx="2.31026" ry="2.25" fill="white"/><ellipse cx="18.8505" cy="28.3969" rx="2.31026" ry="2.25" fill="white"/><path d="M12.4999 34.0219L17.9999 32.0219" stroke="white" stroke-linecap="round"/>`,
    main_color: "#F59E0B",
  },
  Angry: {
    face: `<path d="M17.2425 29.5582C17.4057 29.8045 17.6158 30.0163 17.8608 30.1814C18.1059 30.3465 18.381 30.4618 18.6706 30.5206C18.9601 30.5794 19.2585 30.5806 19.5485 30.5241C19.8385 30.4676 20.1146 30.3545 20.3609 30.1913C20.6072 30.0282 20.819 29.8181 20.9841 29.573C21.1492 29.328 21.2645 29.0529 21.3233 28.7633C21.3821 28.4737 21.3833 28.1754 21.3268 27.8854C21.2703 27.5954 21.1572 27.3193 20.994 27.073L19.1183 28.3156L17.2425 29.5582Z" fill="white"/><path d="M10.1997 27.0074C10.0281 27.248 9.9056 27.52 9.83916 27.8079C9.77271 28.0958 9.76362 28.394 9.81241 28.6854C9.8612 28.9768 9.96691 29.2557 10.1235 29.5063C10.2801 29.7569 10.4845 29.9741 10.7251 30.1457C10.9656 30.3173 11.2376 30.4398 11.5256 30.5062C11.8135 30.5727 12.1116 30.5818 12.4031 30.533C12.6945 30.4842 12.9734 30.3785 13.224 30.2219C13.4746 30.0653 13.6918 29.8609 13.8634 29.6203L12.0315 28.3138L10.1997 27.0074Z" fill="white"/><path d="M12.8932 35.1318C12.8932 35.1318 12.9214 32.1318 15.9073 32.1318C18.8932 32.1318 18.8932 35.1318 18.8932 35.1318" stroke="white" stroke-linecap="round"/>`,
    main_color: "#DC2626",
  },
};

// Cache the state mapping
const STATE_MAP: Record<number, string> = {
  1: "Happy",
  2: "Serious",
  3: "Serious",
  4: "Angry",
};

// Module-level cache for memoization
const svgCache: Record<string, string> = {};

function get_face(state: string, lost_signal: boolean = false) {
  return lost_signal ? disconnected_pin.face : PinState[state].face;
}

function get_background(
  background_color: string,
  outer_line_color: string,
  lost_signal: boolean,
) {
  return `${BACKGROUND_PATHS.background}${BACKGROUND_PATHS.innerColor(
    lost_signal ? disconnected_pin.main_color : background_color,
  )}${BACKGROUND_PATHS.outerLine(outer_line_color)}`;
}

export function createSVGIcon(
  speed_limit_condition: number,
  lost_signal: boolean,
) {
  const state = STATE_MAP[speed_limit_condition] || "Happy";

  // Modify cache key to include lost_signal status
  const cacheKey = `${state}-${lost_signal}`;

  // Check cache first
  if (svgCache[cacheKey]) {
    return svgCache[cacheKey];
  }

  const color = PinState[state].main_color;

  const svg = `${SVG_TEMPLATE}${get_background(color, color, lost_signal)}${get_face(state, lost_signal)}</svg>`;

  // Cache the result with the new cache key
  svgCache[cacheKey] = `data:image/svg+xml;base64,${btoa(svg)}`;

  return svgCache[cacheKey];
}
