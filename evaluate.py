"""Evaluation harness: optimizer vs greedy vs random baselines on synthetic user profiles.
usage: python evaluate.py [N_PROFILES] [--meals]        (default 40 profiles, seed 42)"""
import sys, time, json
import numpy as np, pandas as pd
from scipy.stats import wilcoxon
from engine import FOODS, NUT, UPPER, LEVEL, allowed_pool, recommend
from run import sheet_to_engine

SEED = 42
KEYS_MIN = ["fiber", "iron", "calcium", "zinc", "magnesium", "potassium", "vit_a", "vit_c", "folate"]

# ---------------- 1. calculator (formulas from the guide, output = sheet.json format) ----------------
def build_sheet(age, sex, height, weight, activity, goal, water="moderate", prefs=None):
    bmr = 10 * weight + 6.25 * height - 5 * age + (5 if sex == "male" else -161)
    tdee = bmr * activity
    target = tdee + {"lose": -400, "maintain": 0, "gain": 400}[goal]
    target = max(target, 1500 if sex == "male" else 1200)
    fat = target * 0.30 / 9
    prot = {"minimum": 0.8 * weight, "optimum": 1.6 * weight, "maximum": 2.2 * weight}
    carbs = {k: (target - 4 * v - 9 * fat) / 4 for k, v in prot.items()}
    m = sex == "male"
    return {"inputs": dict(age=age, sex=sex, height_cm=height, weight_kg=weight, activity_factor=activity, goal=goal, water_level=water),
            "energy": {"bmr": round(bmr), "tdee": round(tdee), "target_calories": round(target)},
            "fat": {"min_g": round(target * 0.2 / 9), "target_g": round(fat), "saturated_g": round(fat / 3), "unsaturated_g": round(fat * 2 / 3)},
            "fiber_g": round(14 * target / 1000),
            "protein": {k: {"g": round(v), "kcal": round(4 * v)} for k, v in prot.items()},
            "carbs_g": {k: round(v) for k, v in carbs.items()},
            "water_ml": {"normal": round(35 * weight), "moderate": round(45 * weight), "extreme": round(55 * weight)},
            "micronutrients": {"vitamin_a_ug": 900 if m else 700, "vitamin_c_mg": 90 if m else 75, "vitamin_d_ug": 15, "vitamin_e_mg": 15,
                               "vitamin_k_ug": 120 if m else 90, "b1_mg": 1.2 if m else 1.1, "b2_mg": 1.3 if m else 1.1, "b3_mg": 16 if m else 14,
                               "b6_mg": 1.3, "b12_ug": 2.4, "folate_ug": 400, "calcium_mg": 1000, "iron_mg": 8 if m else 18,
                               "magnesium_mg": 400 if m else 310, "zinc_mg": 11 if m else 8, "potassium_mg": 3400 if m else 2600,
                               "selenium_ug": 55, "iodine_ug": 150, "sodium_limit_mg": 2300},
            "omega3": {"ala_g": 1.6 if m else 1.1, "epa_mg": 250, "dha_mg": 250},
            "preferences": prefs or {"diet": "vegetarian"}}

def test_calculator():            # the three worked examples of the guide
    a = build_sheet(30, "male", 175, 75, 1.55, "lose"); assert (a["energy"]["bmr"], a["energy"]["tdee"], a["energy"]["target_calories"]) == (1699, 2633, 2233)
    assert a["carbs_g"] == {"minimum": 331, "optimum": 271, "maximum": 226} and a["fat"]["target_g"] == 74 and a["fiber_g"] == 31
    b = build_sheet(28, "female", 162, 60, 1.375, "maintain"); assert (b["energy"]["bmr"], b["energy"]["target_calories"]) == (1312, 1803)
    assert b["carbs_g"] == {"minimum": 268, "optimum": 220, "maximum": 184}
    c = build_sheet(25, "male", 180, 70, 1.725, "gain"); assert (c["energy"]["bmr"], c["energy"]["target_calories"]) == (1705, 3341)

# ---------------- 2. synthetic profiles ----------------
def make_profiles(n, seed=SEED):
    rng = np.random.default_rng(seed); out = []
    for _ in range(n):
        sex = rng.choice(["male", "female"])
        h = rng.normal(172, 7) if sex == "male" else rng.normal(158, 6)
        bmi = rng.normal(24, 3.5) if sex == "male" else rng.normal(23.5, 4)
        w = max(42, bmi * (h / 100) ** 2)
        diet = rng.choice(["vegetarian", "vegan", "egg", "nonveg"], p=[0.40, 0.12, 0.10, 0.38])
        pool_all = ["gluten", "dairy", "peanut", "tree_nut", "soy", "sesame"] + (["egg"] if diet in ("egg", "nonveg") else []) + (["fish", "shellfish"] if diet == "nonveg" else [])
        allergies = [str(a) for a in rng.choice(pool_all, size=rng.integers(1, 3), replace=False)] if rng.random() < 0.3 else []
        dislikes = [str(d) for d in rng.choice(["spinach", "paneer", "mushroom", "brinjal", "okra", "curd", "banana", "tofu", "oats"], size=rng.integers(1, 3), replace=False)] if rng.random() < 0.4 else []
        jain = bool(diet in ("vegetarian", "vegan") and rng.random() < 0.10)
        out.append(build_sheet(int(rng.integers(18, 51)), str(sex), round(h), round(w), float(rng.choice([1.2, 1.375, 1.55, 1.725, 1.9])),
                               str(rng.choice(["lose", "maintain", "gain"], p=[0.4, 0.3, 0.3])),
                               prefs={"diet": str(diet), "allergies": allergies, "dislikes": dislikes, "jain": jain}))
    return out

# ---------------- 3. baselines ----------------
def random_baseline(sheet, pool, rng, k=12):
    """random foods, random portions, then scaled to hit the calorie target (best a no-intelligence method can do)"""
    T = sheet["targets"]; idx = rng.choice(pool, size=min(k, len(pool)), replace=False)
    g = FOODS.typical_portion_g[idx].values * rng.uniform(0.5, 1.5, len(idx)); mx = FOODS.max_g[idx].values.astype(float)
    kc = FOODS.kcal[idx].values / 100
    for _ in range(30):
        g = np.minimum(g * T["kcal"] / max((g * kc).sum(), 1), mx)
    return [(int(i), float(x)) for i, x in zip(idx, g) if x >= 5]

def greedy_baseline(sheet, pool, max_foods=14):
    """add one food-step at a time that most reduces the same weighted deviation the optimizer minimises.
    Gets the same hard safety limits (portion caps, upper limits, single-food calorie share) but not the realism rules."""
    T = sheet["targets"]; keys = [k for k in NUT if k in T]; cols = [NUT[k][0] for k in keys]
    M = FOODS.loc[pool, cols].values / 100.0; Tv = np.array([T[k] for k in keys], float)
    W = np.array([NUT[k][2] for k in keys], float); eq = np.array([NUT[k][1] == "eq" for k in keys])
    score = lambda V: (W * np.where(eq, np.abs(V - Tv), np.maximum(Tv - V, 0)) / Tv).sum(-1)
    step = np.maximum(5.0, FOODS.loc[pool, "typical_portion_g"].values / 2); mx = FOODS.loc[pool, "max_g"].values.astype(float)
    kcal = FOODS.loc[pool, "kcal"].values / 100; UL = {c: FOODS.loc[pool, c].values / 100 for c in UPPER}
    g = np.zeros(len(pool))
    for _ in range(300):
        V = g @ M; cand = V + M * step[:, None]; ng = g + step
        ok = (ng <= mx) & (ng * kcal <= 0.35 * T["kcal"]) & ((g > 0) | ((g > 0).sum() < max_foods))
        for c, ub in UPPER.items(): ok &= ng * UL[c] <= ub
        sc = np.where(ok, score(cand), np.inf); b = int(np.argmin(sc))
        if sc[b] >= score(V) - 1e-9: break
        g[b] += step[b]
    return [(int(pool[i]), float(g[i])) for i in range(len(pool)) if g[i] >= 5]

# ---------------- 4. metrics ----------------
def metrics(sheet, plan):
    p, T = sheet["profile"], sheet["targets"]
    tot = {k: sum(gr * FOODS[NUT[k][0]][i] / 100 for i, gr in plan) for k in NUT if k in T}
    cov = {k: tot[k] / T[k] for k in tot}
    ul = sum(sum(gr * FOODS[c][i] / 100 for i, gr in plan) > ub for c, ub in UPPER.items())
    viol = sum((LEVEL[FOODS.diet[i]] > LEVEL[p["diet"]]) or bool(FOODS.allergen_set[i] & set(p["allergies"])) or gr > FOODS.max_g[i] + 1e-6 for i, gr in plan)
    kc = sum(gr * FOODS.kcal[i] / 100 for i, gr in plan); sat = sum(gr * FOODS.sat_fat_g[i] / 100 for i, gr in plan)
    return {"kcal_err": abs(cov["kcal"] - 1), "macro_mae": np.mean([abs(cov[k] - 1) for k in ("kcal", "protein", "fat", "carbs")]),
            "protein_cov": cov["protein"], "micro_adequacy": np.mean([min(cov[k], 1) for k in KEYS_MIN]),
            "micros_ge90": int(sum(cov[k] >= 0.9 for k in KEYS_MIN)), "ul_violations": int(ul),
            "all_constraints_ok": bool(abs(cov["kcal"] - 1) <= 0.05 and cov["protein"] >= 0.95 and ul == 0 and viol == 0
                                       and (100 * sat * 9 / kc if kc else 99) <= 10.5), "rule_violations": int(viol),
            "sat_fat_pct_kcal": 100 * sat * 9 / kc if kc else np.nan, "n_foods": len(plan),
            "mean_popularity": float(np.mean([FOODS.popularity[i] for i, _ in plan])),
            "max_food_kcal_share": max(gr * FOODS.kcal[i] / 100 for i, gr in plan) / kc if kc else np.nan}

def main():
    n = int(next((a for a in sys.argv[1:] if a.isdigit()), 40)); with_meals = "--meals" in sys.argv
    test_calculator(); print("calculator reproduces the 3 worked examples of the guide: OK\n")
    rng = np.random.default_rng(SEED); rows = []
    if with_meals: from meals import recommend_meals
    for n_i, raw in enumerate(make_profiles(n)):
        sheet = sheet_to_engine(raw, "optimum"); pool = allowed_pool(sheet["profile"])
        plans, times = {}, {}
        t = time.time(); r = recommend(sheet)
        times["optimizer"] = time.time() - t
        if r["status"] == "ok": plans["optimizer"] = [(int(FOODS.index[FOODS.common_name == f["name"]][0]), f["grams"]) for f in r["foods"]]
        t = time.time(); plans["greedy"] = greedy_baseline(sheet, pool); times["greedy"] = time.time() - t
        t = time.time(); plans["random"] = random_baseline(sheet, pool, rng); times["random"] = time.time() - t
        if with_meals:
            t = time.time(); rm = recommend_meals(sheet); times["meal_optimizer"] = time.time() - t
            if rm["status"] == "ok":
                plans["meal_optimizer"] = [(int(FOODS.index[FOODS.common_name == f["name"]][0]), f["grams"]) for mv in rm["meals"].values() for f in mv["foods"]]
                ok_meals = np.mean([abs(v["kcal"] / v["target_kcal"] - 1) <= 0.15 for v in rm["meals"].values()])
        for name in ["optimizer", "greedy", "random"] + (["meal_optimizer"] if with_meals else []):
            row = {"profile": n_i, "method": name, "diet": sheet["profile"]["diet"], "n_allergies": len(sheet["profile"]["allergies"]),
                   "kcal_target": sheet["targets"]["kcal"], "seconds": round(times[name], 2), "solved": name in plans and len(plans[name]) > 0}
            if row["solved"]: row.update(metrics(sheet, plans[name]))
            if name == "meal_optimizer" and row["solved"]: row["meals_within_15pct"] = ok_meals
            rows.append(row)
        print(f"profile {n_i + 1}/{n} done", file=sys.stderr, end="\r")
    df = pd.DataFrame(rows); df.to_csv("eval_results.csv", index=False)

    df["all_constraints_ok"] = df["all_constraints_ok"].astype(float)
    cols = ["all_constraints_ok", "kcal_err", "macro_mae", "protein_cov", "micro_adequacy", "micros_ge90", "ul_violations", "rule_violations",
            "sat_fat_pct_kcal", "n_foods", "mean_popularity", "max_food_kcal_share", "seconds"]
    print("\n\nRESULTS (mean over profiles; lower is better for the *_err / mae / violations / sat_fat / max_share columns)")
    summ = df.groupby("method")[cols].mean().round(3); summ.insert(0, "solved_%", (100 * df.groupby("method")["solved"].mean()).round(0))
    print(summ.T.to_string())
    print("\nPAIRED WILCOXON TESTS vs optimizer (same profiles, p < 0.05 = significant difference)")
    for other in [m for m in df.method.unique() if m not in ("optimizer",)]:
        a = df[df.method == "optimizer"].set_index("profile"); b = df[df.method == other].set_index("profile")
        for col in ("macro_mae", "micro_adequacy"):
            j = pd.concat([a[col], b[col]], axis=1, keys=["a", "b"]).dropna()
            if len(j) > 5 and (j.a != j.b).any():
                better = "optimizer" if (j.a.mean() < j.b.mean()) == (col == "macro_mae") else other
                print(f"  {other:<15} {col:<15} optimizer {j.a.mean():.3f} vs {other} {j.b.mean():.3f}   p = {wilcoxon(j.a, j.b).pvalue:.2g}   -> better: {better}")
    print("\nsaved per-profile results to eval_results.csv")

if __name__ == "__main__":
    main()