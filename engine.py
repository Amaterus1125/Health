import numpy as np, pandas as pd, pulp
from sklearn.preprocessing import StandardScaler
from sklearn.neighbors import NearestNeighbors

FOODS = pd.read_csv("indian_foods_final.csv")
NUMERIC = ["kcal","protein","carbs","fat","fibre_total","iron_mg","calcium_mg","zinc_mg","magnesium_mg","potassium_mg",
           "vit_a_rae_ug","vit_c_mg","folate_ug","sat_fat_g","sodium_mg","retinol_ug"]
FOODS[NUMERIC] = FOODS[NUMERIC].fillna(0)            # blank = below detection limit / not reported
FOODS["allergen_set"] = FOODS["allergens"].fillna("").str.split(";").apply(lambda l: {a for a in l if a})

# sheet key -> (column in the food table, kind, weight)
#   eq  = penalise both under and over | min = penalise only shortfall (capped above)
NUT = {"kcal":("kcal","eq",6), "protein":("protein","min",5), "fat":("fat","eq",2), "carbs":("carbs","eq",1.5),
       "fiber":("fibre_total","min",2), "iron":("iron_mg","min",2), "calcium":("calcium_mg","min",2),
       "zinc":("zinc_mg","min",3), "magnesium":("magnesium_mg","min",3), "potassium":("potassium_mg","min",1.5),
       "vit_a":("vit_a_rae_ug","min",2), "vit_c":("vit_c_mg","min",1.5), "folate":("folate_ug","min",2)}
UPPER = {"retinol_ug":3000, "iron_mg":45, "zinc_mg":40, "calcium_mg":2500}       # hard safety limits (NIH ULs)
GROUP_CAP = {"fat_oil":40, "nut_seed":60, "condiment":80, "sweetener":25, "dairy":600, "supplement":60,
             "pulse":350, "cereal_millet":450}
ANIMAL = ["meat","poultry","fish","shellfish","egg"]
LEVEL = {"vegan":0, "vegetarian":1, "egg":2, "nonveg":3}
MAX_FOODS, MAX_SHARE = 14, 0.35                      # foods per day; max share of kcal from a single food
MAX_PER_GROUP = {"cereal_millet":3, "pulse":3, "leafy_green":2, "vegetable":3, "fruit":3, "root_tuber":1, "nut_seed":3,
                 "dairy":3, "fat_oil":1, "condiment":3}
PAIRS = [("A015","DRV-RICE"),("B021","DRV-TOORDAL"),("B010","DRV-MOONGDAL"),("A019","DRV-ROTI")]
MIN_ANIMAL_G = {"nonveg":120, "egg":50}              # a non-veg/egg eater should actually get some meat/fish/egg

def allowed_pool(p, include_supplements=False):
    ok = []
    for i, r in FOODS.iterrows():
        if LEVEL[r.diet] > LEVEL[p["diet"]]: continue
        if r.allergen_set & set(p.get("allergies", [])): continue
        if any(d.lower() in (r.common_name + " " + r.food_name).lower() for d in p.get("dislikes", [])): continue
        if p.get("jain") and not r.jain_ok: continue
        if r.food_group == "supplement" and not include_supplements: continue
        ok.append(i)
    return ok

def recommend(sheet, include_supplements=False, time_limit=30):
    p, T = sheet["profile"], sheet["targets"]
    pool = allowed_pool(p, include_supplements)
    prob = pulp.LpProblem("plan", pulp.LpMinimize)
    g = {i: pulp.LpVariable(f"g{i}", lowBound=0, upBound=float(FOODS.max_g[i])) for i in pool}   # grams
    y = {i: pulp.LpVariable(f"y{i}", cat="Binary") for i in pool}                                  # food used?
    big = {i: pulp.LpVariable(f"b{i}", lowBound=0) for i in pool}                                  # grams above 1.5x typical
    tot = lambda col: pulp.lpSum(g[i] * FOODS[col][i] / 100 for i in pool)
    obj = []
    for i in pool:
        prob += g[i] <= FOODS.max_g[i] * y[i]
        prob += g[i] >= 0.4 * FOODS.typical_portion_g[i] * y[i]                     # no 2 g of anything
        prob += g[i] * FOODS.kcal[i] / 100 <= MAX_SHARE * T["kcal"]                 # no single-food diets
        prob += big[i] >= g[i] - 1.5 * FOODS.typical_portion_g[i]
        obj.append(0.0005 * big[i])                                                 # prefer normal portions
    prob += pulp.lpSum(y.values()) <= MAX_FOODS
    obj.append(pulp.lpSum(0.02 * (3 - FOODS.popularity[i]) * y[i] for i in pool))   # prefer commonly eaten foods
    for a, b in PAIRS:                                                              # never raw AND cooked version
        ia, ib = FOODS.index[FOODS.food_code == a], FOODS.index[FOODS.food_code == b]
        if len(ia) and len(ib) and ia[0] in y and ib[0] in y: prob += y[ia[0]] + y[ib[0]] <= 1
    for grp, mx in MAX_PER_GROUP.items():
        m = [i for i in pool if FOODS.food_group[i] == grp]
        if m: prob += pulp.lpSum(y[i] for i in m) <= mx
    for k, (col, kind, w) in NUT.items():
        if k not in T: continue
        s, o = pulp.LpVariable(f"s_{k}", lowBound=0), pulp.LpVariable(f"o_{k}", lowBound=0)
        if kind == "eq":
            prob += tot(col) + s - o == T[k]; obj.append(w * (s + o) / T[k])
        else:
            prob += tot(col) + s >= T[k]; obj.append(w * s / T[k])
            if k == "protein": prob += tot(col) <= T.get("protein_max", 1.4 * T[k])
            else:                                                                   # soft cap: no 4x-RDA micronutrient plans
                o2 = pulp.LpVariable(f"o2_{k}", lowBound=0)
                prob += tot(col) - o2 <= 2 * T[k]; obj.append(0.3 * w * o2 / T[k])
    sat = pulp.LpVariable("sat_over", lowBound=0); na = pulp.LpVariable("na_over", lowBound=0)
    prob += tot("sat_fat_g") - sat <= 0.10 * T["kcal"] / 9; obj.append(3 * sat / (0.10 * T["kcal"] / 9))
    prob += tot("sodium_mg") - na <= 2300;                  obj.append(1 * na / 2300)
    for col, ub in UPPER.items(): prob += tot(col) <= ub
    for grp, cap in GROUP_CAP.items():
        m = [i for i in pool if FOODS.food_group[i] == grp]
        if m: prob += pulp.lpSum(g[i] for i in m) <= cap
    an = [i for i in pool if FOODS.food_group[i] in ANIMAL]
    if an:
        prob += pulp.lpSum(g[i] for i in an) <= 400
        if p["diet"] in MIN_ANIMAL_G: prob += pulp.lpSum(g[i] for i in an) >= MIN_ANIMAL_G[p["diet"]]
    for grp, lo in {("leafy_green","vegetable"): 200, ("fruit",): 100}.items():
        m = [i for i in pool if FOODS.food_group[i] in grp]
        if m: prob += pulp.lpSum(g[i] for i in m) >= lo
    prob += pulp.lpSum(obj)
    prob.solve(pulp.PULP_CBC_CMD(msg=0, timeLimit=time_limit))
    if pulp.LpStatus[prob.status] != "Optimal":
        return {"status": pulp.LpStatus[prob.status], "foods": []}

    picked = [(i, int(round(g[i].value() / 5.0)) * 5) for i in pool if g[i].value() and g[i].value() > 1]
    picked = [(i, gr) for i, gr in picked if gr > 0]
    totals = {k: round(float(sum(gr * FOODS[c][i] / 100 for i, gr in picked)), 1) for k, (c, _, _) in NUT.items() if k in T}
    cov = {k: round(float(totals[k] / T[k]), 2) for k in totals}
    return {"status": "ok",
            "foods": [{"name": FOODS.common_name[i], "grams": gr, "group": FOODS.food_group[i], "state": FOODS.raw_or_cooked[i],
                       "swaps": substitutes(FOODS.common_name[i], pool, 3)} for i, gr in picked],
            "totals": totals, "coverage": cov,
            "gaps": [k for k, v in cov.items() if v < 0.90 and NUT[k][1] == "min"]}

# ---------------- KNN substitutes ----------------
FEATS = ["kcal","protein","carbs","fat","fibre_total","iron_mg","calcium_mg","zinc_mg","magnesium_mg","potassium_mg",
         "vit_a_rae_ug","vit_c_mg","folate_ug"]
X = StandardScaler().fit_transform(np.log1p(FOODS[FEATS].clip(lower=0)))           # log: nutrient values are very skewed

def substitutes(name, pool, k=3):
    i = FOODS.index[FOODS.common_name == name][0]
    same = [j for j in pool if j != i and FOODS.food_group[j] == FOODS.food_group[i]]
    if not same: return []
    nn = NearestNeighbors(n_neighbors=min(k, len(same))).fit(X[same])
    _, idx = nn.kneighbors(X[[i]])
    return [FOODS.common_name[same[j]] for j in idx[0]]

def replace(sheet, remove):
    """User rejects foods -> rerun optimizer without them, and show KNN suggestions for each removed food."""
    s = {**sheet, "profile": {**sheet["profile"], "dislikes": sheet["profile"].get("dislikes", []) + remove}}
    pool = allowed_pool(s["profile"])
    return recommend(s), {r: substitutes(r, pool, 3) for r in remove if (FOODS.common_name == r).any()}

# ---------------- automatic checks (use these for your evaluation) ----------------
def check(sheet, result):
    p, T = sheet["profile"], sheet["targets"]; bad = []
    for f in result["foods"]:
        r = FOODS[FOODS.common_name == f["name"]].iloc[0]
        if LEVEL[r.diet] > LEVEL[p["diet"]]: bad.append(("diet", f["name"]))
        if r.allergen_set & set(p.get("allergies", [])): bad.append(("allergy", f["name"]))
        if f["grams"] > r.max_g: bad.append(("portion", f["name"]))
    c = result["coverage"]
    if abs(c["kcal"] - 1) > 0.05: bad.append(("kcal_off", c["kcal"]))
    if c["protein"] < 0.95: bad.append(("protein_low", c["protein"]))
    return bad