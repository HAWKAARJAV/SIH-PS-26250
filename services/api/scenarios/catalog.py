"""Static fictional catalogue for theatre MERIDIAN. No real units or weapons."""

from __future__ import annotations

EPOCH = "2026-10-05T06:00:00+00:00"

TIER_WEIGHT = {1: 1_000_000, 2: 20_000, 3: 1_000, 4: 80, 5: 8}

LOADOUTS = [
    {"code": "LC-A", "description": "Light self-escort class", "compat": ["MRF"]},
    {"code": "LC-B", "description": "Air-defence patrol class", "compat": ["MRF"]},
    {"code": "LC-C", "description": "Extended patrol class", "compat": ["MRF", "INT"]},
    {"code": "LC-D", "description": "Interdiction class", "compat": ["INT"]},
    {"code": "LC-E", "description": "Close-support class", "compat": ["MRF"]},
    {"code": "LC-F", "description": "Sensor-only class", "compat": ["AWC", "ISR", "UAV"]},
    {"code": "LC-G", "description": "Airlift pallet class", "compat": ["TPT"]},
    {"code": "LC-H", "description": "Tanker offload class", "compat": ["TKR"]},
    {"code": "LC-I", "description": "Rescue hoist class", "compat": ["ROT"]},
]

AIRCRAFT_TYPES = [
    {
        "id": "MRF",
        "cls": "fighter",
        "role_tags": ["patrol", "escort", "support"],
        "range_nm": 480,
        "endurance_min": 95,
        "crew_req": ["PLT"],
        "load_out_compat": ["LC-A", "LC-B", "LC-C", "LC-E"],
        "aar_capable": True,
        "min_turnaround_min": 45,
    },
    {
        "id": "INT",
        "cls": "fighter",
        "role_tags": ["interdiction"],
        "range_nm": 620,
        "endurance_min": 110,
        "crew_req": ["PLT", "WSO"],
        "load_out_compat": ["LC-C", "LC-D"],
        "aar_capable": True,
        "min_turnaround_min": 60,
    },
    {
        "id": "AWC",
        "cls": "surveillance",
        "role_tags": ["aewc"],
        "range_nm": 900,
        "endurance_min": 240,
        "crew_req": ["PLT", "ACO"],
        "load_out_compat": ["LC-F"],
        "aar_capable": True,
        "min_turnaround_min": 90,
    },
    {
        "id": "TKR",
        "cls": "tanker",
        "role_tags": ["aar"],
        "range_nm": 1100,
        "endurance_min": 240,
        "crew_req": ["PLT", "ARO"],
        "load_out_compat": ["LC-H"],
        "aar_capable": False,
        "min_turnaround_min": 90,
    },
    {
        "id": "TPT",
        "cls": "airlift",
        "role_tags": ["airlift"],
        "range_nm": 800,
        "endurance_min": 180,
        "crew_req": ["PLT", "LM"],
        "load_out_compat": ["LC-G"],
        "aar_capable": False,
        "min_turnaround_min": 75,
    },
    {
        "id": "ISR",
        "cls": "surveillance",
        "role_tags": ["isr"],
        "range_nm": 700,
        "endurance_min": 160,
        "crew_req": ["PLT", "SNS"],
        "load_out_compat": ["LC-F"],
        "aar_capable": True,
        "min_turnaround_min": 60,
    },
    {
        "id": "ROT",
        "cls": "rotary",
        "role_tags": ["sar"],
        "range_nm": 180,
        "endurance_min": 120,
        "crew_req": ["PLT", "RESCUE"],
        "load_out_compat": ["LC-I"],
        "aar_capable": False,
        "min_turnaround_min": 40,
    },
    {
        "id": "UAV",
        "cls": "uncrewed",
        "role_tags": ["isr"],
        "range_nm": 520,
        "endurance_min": 480,
        "crew_req": ["UAV-OP"],
        "load_out_compat": ["LC-F"],
        "aar_capable": False,
        "min_turnaround_min": 30,
    },
]

BASES = [
    {"id": "BASE-ALFA", "name": "Alfa", "lat": 14.50, "lon": 64.20, "launch": 4, "recover": 4, "parking": 28, "fuel": 0.82},
    {"id": "BASE-BRAVO", "name": "Bravo", "lat": 15.45, "lon": 65.55, "launch": 3, "recover": 3, "parking": 22, "fuel": 0.74},
    {"id": "BASE-CHARLIE", "name": "Charlie", "lat": 13.65, "lon": 65.85, "launch": 3, "recover": 3, "parking": 20, "fuel": 0.69},
    {"id": "BASE-DELTA", "name": "Delta", "lat": 14.85, "lon": 67.05, "launch": 2, "recover": 2, "parking": 16, "fuel": 0.77},
]

# Counts per base, summing to the default 64-aircraft theatre.
FLEET_PLAN = [
    ("MRF", ["BASE-ALFA"] * 10 + ["BASE-BRAVO"] * 8 + ["BASE-CHARLIE"] * 6),
    ("INT", ["BASE-ALFA"] * 4 + ["BASE-BRAVO"] * 4 + ["BASE-DELTA"] * 2),
    ("AWC", ["BASE-ALFA"] * 2 + ["BASE-CHARLIE"] * 2),
    ("TKR", ["BASE-ALFA"] * 2 + ["BASE-BRAVO"] * 2 + ["BASE-DELTA"] * 2),
    ("TPT", ["BASE-CHARLIE"] * 4 + ["BASE-DELTA"] * 4),
    ("ISR", ["BASE-ALFA"] * 2 + ["BASE-CHARLIE"] * 2),
    ("ROT", ["BASE-DELTA"] * 4),
    ("UAV", ["BASE-BRAVO"] * 4),
]

CREW_PLAN = [
    ("PLT", "MRF", 40),
    ("PLT", "INT", 12),
    ("WSO", "INT", 12),
    ("PLT", "AWC", 6),
    ("ACO", "AWC", 6),
    ("PLT", "TKR", 8),
    ("ARO", "TKR", 8),
    ("PLT", "TPT", 10),
    ("LM", "TPT", 10),
    ("PLT", "ISR", 6),
    ("SNS", "ISR", 6),
    ("PLT", "ROT", 6),
    ("RESCUE", "ROT", 6),
    ("UAV-OP", "UAV", 4),
]

MISSION_TYPES = ["ADP", "ESCORT", "INT", "CAS", "ISR", "AEWC", "AAR", "AIRLIFT", "SAR"]

MISSION_TEMPLATE = {
    "ADP": {"type_id": "MRF", "load_out": "LC-B", "quals": ["PLT"], "duration": 90, "slots": 2},
    "ESCORT": {"type_id": "MRF", "load_out": "LC-A", "quals": ["PLT"], "duration": 80, "slots": 2},
    "INT": {"type_id": "INT", "load_out": "LC-D", "quals": ["PLT", "WSO"], "duration": 100, "slots": 1},
    "CAS": {"type_id": "MRF", "load_out": "LC-E", "quals": ["PLT"], "duration": 75, "slots": 2},
    "ISR": {"type_id": "ISR", "load_out": "LC-F", "quals": ["PLT", "SNS"], "duration": 120, "slots": 1},
    "AEWC": {"type_id": "AWC", "load_out": "LC-F", "quals": ["PLT", "ACO"], "duration": 180, "slots": 1},
    "AAR": {"type_id": "TKR", "load_out": "LC-H", "quals": ["PLT", "ARO"], "duration": 150, "slots": 1},
    "AIRLIFT": {"type_id": "TPT", "load_out": "LC-G", "quals": ["PLT", "LM"], "duration": 110, "slots": 1},
    "SAR": {"type_id": "ROT", "load_out": "LC-I", "quals": ["PLT", "RESCUE"], "duration": 80, "slots": 1},
}

DEFAULT_PARAMETERS = {
    "duty_limit_min": 720,
    "flight_limit_24h_min": 480,
    "flight_limit_7d_min": 1800,
    "min_rest_min": 720,
    "prep_min": 30,
    "freeze_window_min": 60,
    "p_go_min": 0.8,
    "stale_wx_p_go_min": 0.9,
    "p_mc_min": 0.7,
    "pmc_p_mc_min": 0.5,
    "accept_pmc": False,
    "max_sorties_day": 3,
    "reserve_by_type": {"MRF": 2, "INT": 1, "TKR": 1, "AWC": 1, "TPT": 1, "ISR": 1, "ROT": 1, "UAV": 0},
    "two_person_p1": True,
    "two_person_min_missions": 8,
    "weights": {"value": 1, "risk": 20, "stability": 800, "lateness": 2, "fatigue": 8, "tanker": 400, "wear": 20},
}

SOURCES = [
    {"id": "MSS", "name": "Maintenance and Serviceability", "domain": "aircraft", "cadence_min": 5, "reliability": 0.96, "tau_min": 30},
    {"id": "CRFR", "name": "Crew Roster and Flight Records", "domain": "crew", "cadence_min": 15, "reliability": 0.93, "tau_min": 45},
    {"id": "ASL", "name": "Armament and Stores Ledger", "domain": "stores", "cadence_min": 30, "reliability": 0.9, "tau_min": 60},
    {"id": "AMF", "name": "Airspace Management Feed", "domain": "airspace", "cadence_min": 10, "reliability": 0.95, "tau_min": 20},
    {"id": "MET", "name": "Meteorological Feed", "domain": "weather", "cadence_min": 15, "reliability": 0.88, "tau_min": 40},
    {"id": "TIP", "name": "Threat and Intelligence Picture", "domain": "threat", "cadence_min": 10, "reliability": 0.8, "tau_min": 25},
    {"id": "TAP", "name": "Tasking and Priorities", "domain": "missions", "cadence_min": 20, "reliability": 0.97, "tau_min": 60},
    {"id": "EXF", "name": "Execution Feedback", "domain": "execution", "cadence_min": 5, "reliability": 0.91, "tau_min": 15},
]
