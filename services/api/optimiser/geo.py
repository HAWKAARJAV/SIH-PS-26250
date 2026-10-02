"""Theatre geometry on a fictional chart. Distances are nautical miles."""

from __future__ import annotations

import math

EARTH_NM = 3440.065


def haversine_nm(a: tuple[float, float], b: tuple[float, float]) -> float:
    lat1, lon1 = math.radians(a[0]), math.radians(a[1])
    lat2, lon2 = math.radians(b[0]), math.radians(b[1])
    dlat = lat2 - lat1
    dlon = lon2 - lon1
    h = math.sin(dlat / 2) ** 2 + math.cos(lat1) * math.cos(lat2) * math.sin(dlon / 2) ** 2
    return 2 * EARTH_NM * math.asin(min(1.0, math.sqrt(h)))


def point_segment_nm(
    point: tuple[float, float], start: tuple[float, float], end: tuple[float, float]
) -> float:
    samples = 8
    best = haversine_nm(point, start)
    for i in range(1, samples + 1):
        t = i / samples
        lat = start[0] + (end[0] - start[0]) * t
        lon = start[1] + (end[1] - start[1]) * t
        best = min(best, haversine_nm(point, (lat, lon)))
    return best


def route_exposure_nm(route: list[list[float]], centre: tuple[float, float]) -> float:
    if len(route) < 2:
        return haversine_nm(centre, (route[0][0], route[0][1])) if route else 9999.0
    best = 9999.0
    for i in range(len(route) - 1):
        best = min(
            best,
            point_segment_nm(centre, (route[i][0], route[i][1]), (route[i + 1][0], route[i + 1][1])),
        )
    return best
