"""Meal-wise planner: same targets as engine.recommend, but foods are assigned to breakfast / lunch / snack / dinner."""
import pulp
from engine import (FOODS, NUT, UPPER, GROUP_CAP, ANIMAL, MAX_FOODS, MAX_SHARE, MAX_PER_GROUP, PAIRS,
                    MIN_ANIMAL_G, allowed_pool, substitutes)

B, L, S, D = "breakfast", "lunch", "snack", "dinner"
MEAL_SHARE = {B: 0.25, L: 0.35, S: 0.10, D: 0.30}            # share of the day's calories (change in preferences.meals)
MEAL_PROTEIN_MIN = {B: 0.18, L: 0.25, S: 0.0, D: 0.25}        # share of the day's protein each meal should carry
MEAL_MAX_FOODS = {B: 5, L: 6, S: 3, D: 6}

BY_GROUP = {"cereal_millet": {L, D}, "pulse": {L, D}, "leafy_green": {L, D}, "vegetable": {L, D}, "root_tuber": {L, D},
            "fruit": {B, S}, "nut_seed": {B, S}, "dairy": {B, L, S, D}, "fat_oil": {B, L, D}, "condiment": {L, D},
            "sweetener": {B, S}, "beverage": {S}, "egg": {B, D}, "poultry": {L, D}, "meat": {L, D}, "fish": {L, D},
            "shellfish": {L, D}, "supplement": {B, S}}
# name-prefix overrides: which meals a specific food may appear in
OVERRIDE = {B: ["Oats", "Poha", "Murmura", "Suji", "Seviyan", "Ragi", "Atta", "Roti", "Besan", "Maida", "Rajgira", "Tofu",
                "Soya chunks", "Whole moong", "Tomato", "Kheera", "Gajar", "Aloo", "Methi", "Paneer", "Ghee", "Corn, tender"],
            S: ["Murmura", "Kala chana", "Kheera", "Gajar", "Corn, tender", "Sweet corn", "Chaas", "Whey", "Milk", "Pudina"],
            L: ["Paneer", "Dahi", "Chaas", "Nimbu", "Imli", "Pudina"], D: ["Milk", "Paneer", "Nimbu", "Imli"]}


ONLY = {"Oats": {B, S}, "Poha": {B, S}, "Murmura": {B, S}, "Suji": {B}, "Seviyan": {B}, "Maida": {B, L, D},
        "Rajgira": {B, L, D}, "Whey": {B, S}}                   # foods tied to specific meals (replaces the group default)

def tags(r):
    t = set(BY_GROUP.get(r.food_group, {L, D}))
    for prefix, only in ONLY.items():
        if r.common_name.startswith(prefix): return set(only)
    for meal, prefixes in OVERRIDE.items():
        if any(r.common_name.startswith(p) for p in prefixes): t.add(meal)
    if r.common_name.startswith(("Nimbu", "Imli")): t -= {B, S}
    if r.common_name.startswith("Chaas"): t -= {B, D}
    return t

def recommend_meals(sheet, shares=None, include_supplements=False, time_limit=90):
    p, T = sheet["profile"], sheet["targets"]
    shares = shares or MEAL_SHARE
    meals = [m for m in (B, L, S, D) if shares.get(m, 0) > 0]
    tot_share = sum(shares[m] for m in meals); shares = {m: shares[m] / tot_share for m in meals}
    pool = allowed_pool(p, include_supplements)
    ok = {i: tags(FOODS.loc[i]) & set(meals) for i in pool}
    pool = [i for i in pool if ok[i]]
    pm = [(i, m) for i in pool for m in meals if m in ok[i]]

    prob = pulp.LpProblem("meals", pulp.LpMinimize)
    g = {(i, m): pulp.LpVariable(f"g_{i}_{m}", lowBound=0, upBound=float(min(FOODS.max_g[i], 2 * FOODS.typical_portion_g[i]))) for i, m in pm}
    ym = {(i, m): pulp.LpVariable(f"ym_{i}_{m}", cat="Binary") for i, m in pm}
    y = {i: pulp.LpVariable(f"y_{i}", cat="Binary") for i in pool}
    big = {(i, m): pulp.LpVariable(f"b_{i}_{m}", lowBound=0) for i, m in pm}
    obj = []

    day = lambda col: pulp.lpSum(g[i, m] * FOODS[col][i] / 100 for i, m in pm)
    meal = lambda col, mm: pulp.lpSum(g[i, m] * FOODS[col][i] / 100 for i, m in pm if m == mm)

    for i, m in pm:
        typ = FOODS.typical_portion_g[i]
        prob += g[i, m] <= min(FOODS.max_g[i], 2 * typ) * ym[i, m]
        prob += g[i, m] >= 0.4 * typ * ym[i, m]
        prob += y[i] >= ym[i, m]
        prob += big[i, m] >= g[i, m] - 1.5 * typ
        obj.append(0.0005 * big[i, m])
    for i in pool:
        ms = [m for m in meals if (i, m) in g]
        prob += pulp.lpSum(g[i, m] for m in ms) <= FOODS.max_g[i]                              # daily portion cap
        prob += pulp.lpSum(g[i, m] * FOODS.kcal[i] / 100 for m in ms) <= MAX_SHARE * T["kcal"]   # no single-food diets
        prob += pulp.lpSum(ym[i, m] for m in ms) <= 2                                           # a food in at most 2 meals
    prob += pulp.lpSum(y.values()) <= MAX_FOODS + 2
    obj.append(pulp.lpSum(0.02 * (3 - FOODS.popularity[i]) * y[i] for i in pool))
    for a, b in PAIRS:
        ia, ib = FOODS.index[FOODS.food_code == a], FOODS.index[FOODS.food_code == b]
        if len(ia) and len(ib) and ia[0] in y and ib[0] in y: prob += y[ia[0]] + y[ib[0]] <= 1
    for grp, mx in MAX_PER_GROUP.items():
        mem = [i for i in pool if FOODS.food_group[i] == grp]
        if mem: prob += pulp.lpSum(y[i] for i in mem) <= mx

    # ---- per-meal rules ----
    for m in meals:
        mem = [i for i in pool if (i, m) in g]
        prob += pulp.lpSum(ym[i, m] for i in mem) <= MEAL_MAX_FOODS[m]
        for grp in set(FOODS.food_group[i] for i in mem):
            cap = 1 if grp == "fat_oil" else (3 if grp == "condiment" else 2)
            prob += pulp.lpSum(ym[i, m] for i in mem if FOODS.food_group[i] == grp) <= cap
        tk = shares[m] * T["kcal"]
        s, o = pulp.LpVariable(f"ms_{m}", lowBound=0), pulp.LpVariable(f"mo_{m}", lowBound=0)
        prob += meal("kcal", m) + s - o == tk; obj.append(4 * (s + o) / tk)                     # meal calories close to its share
        if MEAL_PROTEIN_MIN[m] > 0:
            ps = pulp.LpVariable(f"mp_{m}", lowBound=0); pt = MEAL_PROTEIN_MIN[m] * T["protein"]
            prob += meal("protein", m) + ps >= pt; obj.append(2 * ps / pt)
        if m in (L, D):                                                                          # a proper lunch/dinner
            cs = pulp.LpVariable(f"mc_{m}", lowBound=0); vs = pulp.LpVariable(f"mv_{m}", lowBound=0)
            prob += pulp.lpSum(g[i, m] * FOODS.kcal[i] / 100 for i in mem if FOODS.food_group[i] == "cereal_millet") + cs >= 0.2 * tk
            prob += pulp.lpSum(g[i, m] for i in mem if FOODS.food_group[i] in ("leafy_green", "vegetable")) + vs >= 80
            obj.append(1.0 * cs / (0.2 * tk)); obj.append(1.0 * vs / 80)

    # ---- day-level nutrient targets (same as the day planner) ----
    for k, (col, kind, w) in NUT.items():
        if k not in T: continue
        s, o = pulp.LpVariable(f"s_{k}", lowBound=0), pulp.LpVariable(f"o_{k}", lowBound=0)
        if kind == "eq":
            prob += day(col) + s - o == T[k]; obj.append(w * (s + o) / T[k])
        else:
            prob += day(col) + s >= T[k]; obj.append(w * s / T[k])
            if k == "protein": prob += day(col) <= T.get("protein_max", 1.4 * T[k])
            else:
                o2 = pulp.LpVariable(f"o2_{k}", lowBound=0)
                prob += day(col) - o2 <= 2 * T[k]; obj.append(0.3 * w * o2 / T[k])
    sat, na = pulp.LpVariable("sat_over", lowBound=0), pulp.LpVariable("na_over", lowBound=0)
    prob += day("sat_fat_g") - sat <= 0.10 * T["kcal"] / 9; obj.append(3 * sat / (0.10 * T["kcal"] / 9))
    prob += day("sodium_mg") - na <= 2300;                  obj.append(1 * na / 2300)
    for col, ub in UPPER.items(): prob += day(col) <= ub
    for grp, cap in GROUP_CAP.items():
        mem = [(i, m) for i, m in pm if FOODS.food_group[i] == grp]
        if mem: prob += pulp.lpSum(g[k] for k in mem) <= cap
    an = [(i, m) for i, m in pm if FOODS.food_group[i] in ANIMAL]
    if an:
        prob += pulp.lpSum(g[k] for k in an) <= 400
        if p["diet"] in MIN_ANIMAL_G: prob += pulp.lpSum(g[k] for k in an) >= MIN_ANIMAL_G[p["diet"]]
    for grp, lo in {("leafy_green", "vegetable"): 200, ("fruit",): 100}.items():
        mem = [(i, m) for i, m in pm if FOODS.food_group[i] in grp]
        if mem: prob += pulp.lpSum(g[k] for k in mem) >= lo

    prob += pulp.lpSum(obj)
    prob.solve(pulp.PULP_CBC_CMD(msg=0, timeLimit=time_limit))
    if pulp.LpStatus[prob.status] != "Optimal":
        return {"status": pulp.LpStatus[prob.status], "meals": {}}

    out, picked = {}, []
    for m in meals:
        items = []
        for i in pool:
            if (i, m) in g and g[i, m].value() and g[i, m].value() > 1:
                gr = int(round(g[i, m].value() / 5.0)) * 5
                if gr > 0: items.append((i, gr)); picked.append((i, gr))
        out[m] = {"target_kcal": round(shares[m] * T["kcal"]),
                  "kcal": round(float(sum(gr * FOODS.kcal[i] / 100 for i, gr in items))),
                  "protein": round(float(sum(gr * FOODS.protein[i] / 100 for i, gr in items)), 1),
                  "foods": [{"name": FOODS.common_name[i], "grams": gr, "state": FOODS.raw_or_cooked[i],
                             "swaps": substitutes(FOODS.common_name[i], pool, 3)} for i, gr in items]}
    totals = {k: round(float(sum(gr * FOODS[c][i] / 100 for i, gr in picked)), 1) for k, (c, _, _) in NUT.items() if k in T}
    cov = {k: round(float(totals[k] / T[k]), 2) for k in totals}
    return {"status": "ok", "meals": out, "totals": totals, "coverage": cov,
            "gaps": [k for k, v in cov.items() if v < 0.90 and NUT[k][1] == "min"]}