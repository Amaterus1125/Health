"""Run the recommendation engine on a nutrition-sheet JSON.

usage:  python run.py                          -> whole-day plan from sheet.json
        python run.py --meals                  -> plan split into breakfast / lunch / snack / dinner
        python run.py vegan.json --meals       -> another file
        python run.py sheet.json --protein maximum --out result.json
"""
import argparse, json, sys
from engine import recommend, check, LEVEL

ALLERGENS = {"gluten", "dairy", "egg", "peanut", "tree_nut", "sesame", "soy", "fish", "shellfish", "mollusc", "coconut"}
LEVELS = ("minimum", "optimum", "maximum")


def sheet_to_engine(raw, protein_level):
    """Convert the nutrition-sheet JSON (same sections as the formula guide) into what engine.py expects."""
    try:
        m = raw["micronutrients"]
        targets = {
            "kcal":      raw["energy"]["target_calories"],
            "protein":   raw["protein"][protein_level]["g"],
            "protein_max": raw["protein"]["maximum"]["g"],
            "fat":       raw["fat"]["target_g"],
            "carbs":     raw["carbs_g"][protein_level],      # carbs shift with the protein level, as in the guide
            "fiber":     raw["fiber_g"],
            "iron":      m["iron_mg"],
            "calcium":   m["calcium_mg"],
            "zinc":      m["zinc_mg"],
            "magnesium": m["magnesium_mg"],
            "potassium": m["potassium_mg"],
            "vit_a":     m["vitamin_a_ug"],
            "vit_c":     m["vitamin_c_mg"],
            "folate":    m["folate_ug"],
        }
    except KeyError as e:
        sys.exit(f"ERROR: your JSON is missing the key {e}. Compare it with the sheet.json example.")

    prefs = raw.get("preferences", {})
    diet = prefs.get("diet")
    if diet is None:
        print("NOTE: no preferences.diet in the JSON, assuming 'vegetarian'\n")
        diet = "vegetarian"
    if diet not in LEVEL:
        sys.exit(f"ERROR: diet must be one of {list(LEVEL)}, got '{diet}'")
    bad = [a for a in prefs.get("allergies", []) if a not in ALLERGENS]
    if bad:
        sys.exit(f"ERROR: unknown allergy {bad}. Allowed: {sorted(ALLERGENS)}")

    profile = {"diet": diet, "allergies": prefs.get("allergies", []),
               "dislikes": prefs.get("dislikes", []), "jain": prefs.get("jain", False)}
    return {"profile": profile, "targets": targets}


def show_food(f):
    unit = "dry weight" if f["state"] == "dry_raw" else f["state"]
    return f"{f['name']:<36} {f['grams']:>4} g  ({unit})   swaps: {', '.join(f['swaps']) or '-'}"


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("file", nargs="?", default="sheet.json")
    ap.add_argument("--protein", choices=LEVELS, default="optimum", help="which protein level of the sheet to aim for")
    ap.add_argument("--meals", action="store_true", help="split the day into breakfast / lunch / snack / dinner")
    ap.add_argument("--supplements", action="store_true", help="allow whey protein in the plan")
    ap.add_argument("--out", help="also save the full result as JSON, e.g. result.json")
    a = ap.parse_args()

    try:
        raw = json.load(open(a.file))
    except FileNotFoundError:
        sys.exit(f"ERROR: file '{a.file}' not found. Run this from the folder that contains it.")
    except json.JSONDecodeError as e:
        sys.exit(f"ERROR: '{a.file}' is not valid JSON ({e}). Check for a trailing comma or a missing quote.")

    sheet = sheet_to_engine(raw, a.protein)
    if a.meals:
        from meals import recommend_meals
        shares = raw.get("preferences", {}).get("meals")      # optional, e.g. {"breakfast":0.3,"lunch":0.4,"dinner":0.3}
        result = recommend_meals(sheet, shares=shares, include_supplements=a.supplements)
    else:
        result = recommend(sheet, include_supplements=a.supplements)
    if result["status"] != "ok":
        sys.exit(f"Optimizer found no plan (status: {result['status']}). The filters may be too strict.")

    p, T = sheet["profile"], sheet["targets"]
    print(f"Profile : {p['diet']} | allergies {p['allergies'] or 'none'} | dislikes {p['dislikes'] or 'none'} | jain {p['jain']}")
    print(f"Targets : {T['kcal']} kcal | protein {T['protein']} g ({a.protein}) | fat {T['fat']} g | carbs {T['carbs']} g\n")

    if a.meals:
        flat = []
        for name, mv in result["meals"].items():
            print(f"{name.upper()}  -  {mv['kcal']} kcal (target {mv['target_kcal']}), protein {mv['protein']} g")
            for f in mv["foods"]:
                print("   " + show_food(f)); flat.append({"name": f["name"], "grams": f["grams"]})
            print()
        to_check = {"foods": flat, "coverage": result["coverage"]}
    else:
        print("RECOMMENDED FOODS (per day)")
        for f in result["foods"]:
            print("  " + show_food(f))
        print()
        to_check = result

    print("NUTRIENTS (whole day, plan vs target)")
    for k, got in result["totals"].items():
        print(f"  {k:<10} target {T[k]:>7}   plan {got:>8}   {result['coverage'][k] * 100:>5.0f}%")
    if result["gaps"]:
        print("\nGaps (below 90% of target):", ", ".join(result["gaps"]))

    water = raw.get("water_ml", {}).get(raw.get("inputs", {}).get("water_level", ""))
    if water:
        print(f"\nWater target from the sheet: {water} ml/day")
    print("Not handled by the optimizer: vitamin D, B12, E, K, B-vitamins, selenium, iodine, omega-3 (data not in the food table).")

    problems = check(sheet, to_check)
    print("\nAUTOMATIC CHECK:", "PASS (no diet/allergy/portion violations, calories and protein on target)" if not problems else f"FAIL {problems}")

    if a.out:
        json.dump({"profile": p, "targets": T, **result}, open(a.out, "w"), indent=2)
        print(f"\nSaved full result to {a.out}")


if __name__ == "__main__":
    main()