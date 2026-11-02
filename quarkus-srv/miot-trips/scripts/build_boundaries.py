#!/usr/bin/env python3
"""Builds the administrative boundaries miot-trips loads from src/main/resources/geo.

Sources:
  Peru  districts  https://github.com/juaneladio/peru-geojson  peru_distrital_simple.geojson (INEI, IDDIST = ubigeo)
  Chile communes   https://github.com/caracena/chile-geojson   1.geojson .. 16.geojson (BCN, cod_comuna = CUT)

Usage: build_boundaries.py PERU_GEOJSON CHILE_DIR OUT_DIR [TOLERANCE_DEGREES]
"""
import glob
import gzip
import json
import os
import sys

DECIMALS = 5


def simplify(points, tolerance):
    if tolerance <= 0 or len(points) < 5:
        return points
    keep = [False] * len(points)
    keep[0] = keep[-1] = True
    stack = [(0, len(points) - 1)]
    while stack:
        first, last = stack.pop()
        (x1, y1), (x2, y2) = points[first], points[last]
        dx, dy = x2 - x1, y2 - y1
        norm = (dx * dx + dy * dy) ** 0.5
        worst, index = 0.0, -1
        for i in range(first + 1, last):
            x, y = points[i]
            d = abs(dy * x - dx * y + x2 * y1 - y2 * x1) / norm if norm else ((x - x1) ** 2 + (y - y1) ** 2) ** 0.5
            if d > worst:
                worst, index = d, i
        if worst > tolerance:
            keep[index] = True
            stack.append((first, index))
            stack.append((index, last))
    out = [p for p, k in zip(points, keep) if k]
    return out if len(out) >= 4 else points


def ring(points, tolerance):
    out = []
    for lon, lat in simplify([(p[0], p[1]) for p in points], tolerance):
        q = [round(lon, DECIMALS), round(lat, DECIMALS)]
        if not out or out[-1] != q:
            out.append(q)
    if out[0] != out[-1]:
        out.append(out[0])
    return out if len(out) >= 4 else None


def polygons(geometry):
    if geometry is None:
        return []
    if geometry["type"] == "Polygon":
        return [geometry["coordinates"]]
    return geometry["coordinates"]


def area_centroid(points):
    a = cx = cy = 0.0
    for (x1, y1), (x2, y2) in zip(points, points[1:]):
        f = x1 * y2 - x2 * y1
        a += f
        cx += (x1 + x2) * f
        cy += (y1 + y2) * f
    if a == 0:
        return points[0][0], points[0][1], 0.0
    return cx / (3 * a), cy / (3 * a), abs(a) / 2


def inside(points, x, y):
    result = False
    j = len(points) - 1
    for i in range(len(points)):
        xi, yi = points[i]
        xj, yj = points[j]
        if (yi > y) != (yj > y) and x < (xj - xi) * (y - yi) / (yj - yi) + xi:
            result = not result
        j = i
    return result


def centroid(polys):
    """The area centroid of the largest polygon; when it falls outside, the middle of the widest crossing at its
    latitude, so a short Plus Code reference always lies in the area."""
    outer = max((p[0] for p in polys), key=lambda r: area_centroid(r)[2])
    x, y, _ = area_centroid(outer)
    if inside(outer, x, y):
        return [round(x, DECIMALS), round(y, DECIMALS)]
    xs = []
    for (x1, y1), (x2, y2) in zip(outer, outer[1:]):
        if (y1 > y) != (y2 > y):
            xs.append(x1 + (y - y1) * (x2 - x1) / (y2 - y1))
    xs.sort()
    pairs = [(xs[i], xs[i + 1]) for i in range(0, len(xs) - 1, 2)]
    a, b = max(pairs, key=lambda p: p[1] - p[0])
    return [round((a + b) / 2, DECIMALS), round(y, DECIMALS)]


def boundary(code, name, province, region, geometry, tolerance):
    polys = []
    for p in polygons(geometry):
        rings = [r for r in (ring(r, tolerance) for r in p) if r]
        if rings and len(rings[0]) >= 4:
            polys.append(rings)
    out = {"code": code, "name": name, "province": province, "region": region}
    if polys:
        xs = [pt[0] for p in polys for pt in p[0]]
        ys = [pt[1] for p in polys for pt in p[0]]
        out["centroid"] = centroid(polys)
        out["bbox"] = [min(xs), min(ys), max(xs), max(ys)]
        out["geometry"] = {"type": "MultiPolygon", "coordinates": polys}
    return out


def write(path, country, source, items):
    items.sort(key=lambda b: b["code"])
    with gzip.open(path, "wt", encoding="utf-8") as f:
        json.dump({"country": country, "source": source, "boundaries": items}, f, ensure_ascii=False,
                  separators=(",", ":"))
    print(path, len(items), "boundaries,", sum(1 for b in items if "geometry" not in b), "without geometry,",
          os.path.getsize(path), "bytes")


def main():
    peru, chile, out = sys.argv[1], sys.argv[2], sys.argv[3]
    tolerance = float(sys.argv[4]) if len(sys.argv) > 4 else 0.0002
    with open(peru, encoding="utf-8") as f:
        pe = [boundary(p["IDDIST"], p["NOMBDIST"], p["NOMBPROV"], p["NOMBDEP"], ft["geometry"], 0)
              for ft in json.load(f)["features"] for p in [ft["properties"]]]
    write(os.path.join(out, "districts-pe.json.gz"), "PE",
          "INEI districts via github.com/juaneladio/peru-geojson (peru_distrital_simple.geojson, MPL-2.0)", pe)
    cl = []
    for path in sorted(glob.glob(os.path.join(chile, "*.geojson"))):
        with open(path, encoding="utf-8") as f:
            for ft in json.load(f)["features"]:
                p = ft["properties"]
                if p["cod_comuna"]:
                    cl.append(boundary(f"{p['cod_comuna']:05d}", p["Comuna"], p["Provincia"], p["Region"],
                                       ft["geometry"], tolerance))
    write(os.path.join(out, "communes-cl.json.gz"), "CL",
          "BCN communes via github.com/caracena/chile-geojson, simplified to %s degrees" % tolerance, cl)


if __name__ == "__main__":
    main()
