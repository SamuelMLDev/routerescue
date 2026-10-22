#!/usr/bin/env python3
"""Independent, reproducible CVRPTW route-column exact reference via SciPy HiGHS MILP.

Different language, different route evaluator and external optimisation backend.
Not OR-Tools. It solves small instances to optimality given the enumerated, complete
set of feasible driver sequences; larger instances are outside its tractable scope.
Nothing here is imported by the production planner or the certificate verifier.
"""
from __future__ import annotations
import argparse
import hashlib
import itertools
import json
import math
import pathlib
import subprocess
import sys
import time
import numpy as np
from scipy.optimize import milp, Bounds, LinearConstraint
from scipy.sparse import lil_matrix

ROOT = pathlib.Path(__file__).resolve().parents[1]
SEED = 0xC0FFEE27
KM_PER_UNIT = 0.075
SPEED = 0.48


def prng(seed):
    # Python deterministic pseudo-random parameters independent of JS solver
    while True:
        seed = (1664525 * seed + 1013904223) & 0xFFFFFFFF
        yield seed / 4294967296


def sample_state(index: int):
    r = prng(SEED + index * 3571)
    size = 5 + index % 2  # five or six stops; complete exact feasible-route enumeration
    depot = {'id': 'depot', 'x': 50, 'y': 50}
    tight = index % 5 == 0
    stops = []
    for i in range(size):
        x = 15 + round(next(r) * 68)
        y = 13 + round(next(r) * 72)
        starts = 540 + int(next(r) * (35 if tight else 75))
        ends = starts + (45 if tight else 135)
        stops.append({'id': f'p{i}', 'name': f'Stop {i}', 'x': x, 'y': y,
                      'service': 5 + index % 4, 'windowStart': starts,
                      'windowEnd': ends, 'load': 1 + (i % 4 == 0),
                      'priority': 'Priority' if (i + index) % 4 == 0 else 'Standard'})
    drivers = [{'id': 'offline', 'name': 'Unavailable', 'capacity': size,
                'maxLoad': size * 2, 'available': True, 'shiftStart': 540,
                'shiftEnd': 950, 'skills': []}]
    active_count = 2
    for j in range(active_count):
        capacity = size - 1 if j == 0 else max(2, math.ceil(size / 2))
        drivers.append({'id': f'active{j}', 'name': f'Active {j}',
                        'available': True, 'capacity': capacity, 'maxLoad': size * 2,
                        'shiftStart': 540, 'shiftEnd': 740 + 15 * (index % 4),
                        'skills': []})
    return {'depot': depot, 'stops': stops, 'drivers': drivers,
            'routes': {'offline': [s['id'] for s in stops], **{d['id']: [] for d in drivers[1:]}},
            'unavailableDriverIds': ['offline'], 'mode': 'normal', 'version': 1}


def dist(a, b):
    return (abs(a['x'] - b['x']) + abs(a['y'] - b['y'])) * KM_PER_UNIT


def feasible_route(driver, depot, stops_by_id, seq):
    if len(seq) > driver['capacity']:
        return None
    point = depot
    minute = driver['shiftStart']
    km = 0.0
    load = 0
    for id_ in seq:
        stop = stops_by_id[id_]
        load += stop['load']
        if load > driver['maxLoad']:
            return None
        leg = dist(point, stop)
        km += leg
        minute = max(minute + math.ceil(leg / SPEED), stop['windowStart'])
        if minute > stop['windowEnd']:
            return None
        minute += stop['service']
        point = stop
    leg = dist(point, depot)
    return km + leg if minute + math.ceil(leg / SPEED) <= driver['shiftEnd'] else None


def optimal_with_highs(scenario):
    active = [d for d in scenario['drivers'] if d['id'] not in scenario['unavailableDriverIds']]
    stops = scenario['stops']; stop_index = {s['id']: i for i, s in enumerate(stops)}
    stop_lookup = {s['id']: s for s in stops}; n = len(stops)
    columns = []
    start = time.perf_counter()
    for j, d in enumerate(active):
        for length in range(1, min(n, d['capacity']) + 1):
            for seq in itertools.permutations(stop_index.keys(), length):
                km = feasible_route(d, scenario['depot'], stop_lookup, seq)
                if km is not None:
                    columns.append((j, seq, km))
    # One binary variable per feasible route plus one uncovered indicator per stop.
    # All feasible sequences are enumerated; thus MILP optimum is the exact optimum
    # of this small, fully specified route model, not a continuous relaxation.
    m = len(columns) + n
    a = lil_matrix((n + len(active), m), dtype=float)
    cost = np.zeros(m)
    for i, (driver, route, km) in enumerate(columns):
        a[n + driver, i] = 1
        for stop_id in route:
            a[stop_index[stop_id], i] = 1
        cost[i] = km
    for j, stop in enumerate(stops):
        a[j, len(columns) + j] = 1
        cost[len(columns) + j] = 1e6 if stop['priority'] == 'Priority' else 1e5
    low = np.array([1.0] * n + [0.0] * len(active))
    high = np.array([1.0] * (n + len(active)))
    solution = milp(cost, integrality=np.ones(m), bounds=Bounds(0, 1),
                    constraints=LinearConstraint(a.tocsr(), low, high),
                    options={'time_limit': 25, 'mip_rel_gap': 0.0})
    if solution.status != 0:
        raise RuntimeError(f'HiGHS did not prove optimality (status={solution.status})')
    selected = [columns[i] for i in range(len(columns)) if solution.x[i] > 0.5]
    uncovered = [stops[j]['id'] for j in range(n) if solution.x[len(columns) + j] > 0.5]
    # Independent postsolve validation: recompute each returned route.
    seen = []
    for drv, route, _ in selected:
        assert feasible_route(active[drv], scenario['depot'], stop_lookup, route) is not None
        seen += list(route)
    assert sorted(seen + uncovered) == sorted(stop_index.keys())
    assert len(seen) == len(set(seen))
    return {'coverage': n - len(uncovered), 'priorityUncovered': sum(stop_lookup[x]['priority'] == 'Priority' for x in uncovered),
            'totalKm': round(sum(x[2] for x in selected), 1), 'status': 'OPTIMAL', 'columns': len(columns),
            'ms': round((time.perf_counter() - start) * 1000, 2)}


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--cases', type=int, default=72)
    parser.add_argument('--output', default='benchmarks/highs-reference.json')
    args = parser.parse_args()
    if not 1 <= args.cases <= 250:
        parser.error('cases must be 1..250')
    scenarios = [sample_state(i) for i in range(args.cases)]
    input_bytes = json.dumps(scenarios, separators=(',', ':')).encode()
    bridge = subprocess.run(['node', str(ROOT / 'scripts/reference-bridge.js')], input=input_bytes,
                            capture_output=True, cwd=ROOT, timeout=240, check=True)
    heuristic = json.loads(bridge.stdout)
    rows = []
    for i, case in enumerate(scenarios):
        exact = optimal_with_highs(case)
        ours = heuristic[i]
        assert ours['coverage'] <= exact['coverage'], f'Heuristic allegedly beat exact coverage on {i}'
        if ours['coverage'] == exact['coverage'] and ours['priorityUncovered'] == exact['priorityUncovered']:
            # Distance gaps are only comparable at identical levels of lexicographic coverage.
            ratio = round(ours['totalKm'] / exact['totalKm'], 4) if exact['totalKm'] > 0 else None
        else:
            ratio = None
        rows.append({'id': i, 'stops': len(case['stops']), 'activeDrivers': len(case['drivers']) - 1,
                     'exact': exact, 'heuristic': ours, 'distanceRatioAtMatchingCoverage': ratio})
    matched = [r['distanceRatioAtMatchingCoverage'] for r in rows if r['distanceRatioAtMatchingCoverage'] is not None]
    full_exact = sum(r['exact']['coverage'] == r['stops'] for r in rows)
    full_ours = sum(r['heuristic']['coverage'] == r['stops'] for r in rows)
    coverage_match = sum(r['exact']['coverage'] == r['heuristic']['coverage'] for r in rows)
    report = {'method': 'Fully enumerated feasible driver-route columns + SciPy HiGHS MILP exact set partitioning',
              'seed': hex(SEED), 'cases': len(rows), 'generatorSha256': hashlib.sha256(input_bytes).hexdigest(),
              'scipyVersion': __import__('scipy').__version__, 'hiGHSStatus': 'OPTIMAL for every case',
              'summary': {'exactFullCoverage': full_exact, 'heuristicFullCoverage': full_ours,
                          'coverageMatchesExact': coverage_match,
                          'averageDistanceRatioWhenCoverageAndPriorityMatch': round(sum(matched)/len(matched), 4) if matched else None,
                          'worstDistanceRatioWhenCoverageAndPriorityMatch': max(matched) if matched else None,
                          'matchedObjectives': len(matched)},
              'rows': rows,
              'limitations': 'Small synthetic 5–7-stop instances. Reference enumerates all feasible sequences and uses SciPy HiGHS, not OR-Tools. No real road/time data. Heuristic can have inferior coverage or distance. Only matching objective levels have comparable distance ratios.'}
    dst = ROOT / args.output
    dst.parent.mkdir(parents=True, exist_ok=True)
    dst.write_text(json.dumps(report, indent=2)+'\n')
    print(json.dumps(report['summary'], indent=2))

if __name__ == '__main__':
    main()
