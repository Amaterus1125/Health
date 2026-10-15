import streamlit as st
import requests
import pandas as pd

# Page config
st.set_page_config(page_title="Nutrition Optimizer UI", layout="wide")
st.title("🥗 Indian Nutrition Plan Generator")

# ---------------- SIDEBAR: User Input Form ----------------
st.sidebar.header("1. Profile & Preferences")

# Basic Stats
age = st.sidebar.number_input("Age", min_value=12, max_value=100, value=30)
sex = st.sidebar.selectbox("Sex", ["male", "female"])
height_cm = st.sidebar.number_input("Height (cm)", min_value=100, max_value=230, value=175)
weight_kg = st.sidebar.number_input("Weight (kg)", min_value=30, max_value=200, value=75)

# Fitness Goal & Activity
activity_factor = st.sidebar.select_slider(
    "Activity Level",
    options=[1.2, 1.375, 1.55, 1.725, 1.9],
    value=1.55,
    format_func=lambda x: {
        1.2: "Sedentary (1.2)",
        1.375: "Light (1.375)",
        1.55: "Moderate (1.55)",
        1.725: "Very Active (1.725)",
        1.9: "Extra Active (1.9)"
    }[x]
)
goal = st.sidebar.selectbox("Goal", ["lose", "maintain", "gain"])

# Diet & Restrictions
st.sidebar.markdown("---")
diet = st.sidebar.selectbox("Diet Type", ["vegetarian", "vegan", "egg", "nonveg"])
allergies = st.sidebar.multiselect(
    "Allergies",
    ["gluten", "dairy", "egg", "peanut", "tree_nut", "sesame", "soy", "fish", "shellfish"]
)
dislikes_str = st.sidebar.text_input("Dislikes (comma-separated)", "spinach, paneer")
jain = st.sidebar.checkbox("Jain Diet Rules", value=False)

# API Engine Settings
st.sidebar.header("2. Engine Settings")
protein_level = st.sidebar.selectbox("Protein Target Level", ["minimum", "optimum", "maximum"], index=1)
split_meals = st.sidebar.checkbox("Split into Meals (B/L/S/D)", value=True)
include_supplements = st.sidebar.checkbox("Include Supplements (e.g. Whey)", value=False)
backend_url = st.sidebar.text_input("Backend API Endpoint", "http://localhost:8000/api/plan")

# ---------------- HELPER: Build Sheet JSON ----------------
def build_sheet_payload():
    bmr = 10 * weight_kg + 6.25 * height_cm - 5 * age + (5 if sex == "male" else -161)
    tdee = bmr * activity_factor
    target = tdee + {"lose": -400, "maintain": 0, "gain": 400}[goal]
    target = max(target, 1500 if sex == "male" else 1200)
    fat = target * 0.30 / 9
    prot = {"minimum": 0.8 * weight_kg, "optimum": 1.6 * weight_kg, "maximum": 2.2 * weight_kg}
    carbs = {k: (target - 4 * v - 9 * fat) / 4 for k, v in prot.items()}
    m = (sex == "male")

    dislikes_list = [d.strip() for d in dislikes_str.split(",") if d.strip()]

    return {
        "inputs": {
            "age": age, "sex": sex, "height_cm": height_cm, "weight_kg": weight_kg,
            "activity_factor": activity_factor, "goal": goal, "water_level": "moderate"
        },
        "energy": {"bmr": round(bmr), "tdee": round(tdee), "target_calories": round(target)},
        "fat": {
            "min_g": round(target * 0.2 / 9), "target_g": round(fat),
            "saturated_g": round(fat / 3), "unsaturated_g": round(fat * 2 / 3)
        },
        "fiber_g": round(14 * target / 1000),
        "protein": {k: {"g": round(v), "kcal": round(4 * v)} for k, v in prot.items()},
        "carbs_g": {k: round(v) for k, v in carbs.items()},
        "water_ml": {"normal": round(35 * weight_kg), "moderate": round(45 * weight_kg), "extreme": round(55 * weight_kg)},
        "micronutrients": {
            "vitamin_a_ug": 900 if m else 700, "vitamin_c_mg": 90 if m else 75, "vitamin_d_ug": 15, "vitamin_e_mg": 15,
            "vitamin_k_ug": 120 if m else 90, "b1_mg": 1.2 if m else 1.1, "b2_mg": 1.3 if m else 1.1, "b3_mg": 16 if m else 14,
            "b6_mg": 1.3, "b12_ug": 2.4, "folate_ug": 400, "calcium_mg": 1000, "iron_mg": 8 if m else 18,
            "magnesium_mg": 400 if m else 310, "zinc_mg": 11 if m else 8, "potassium_mg": 3400 if m else 2600,
            "selenium_ug": 55, "iodine_ug": 150, "sodium_limit_mg": 2300
        },
        "omega3": {"ala_g": 1.6 if m else 1.1, "epa_mg": 250, "dha_mg": 250},
        "preferences": {
            "diet": diet,
            "allergies": allergies,
            "dislikes": dislikes_list,
            "jain": jain
        }
    }

sheet_json = build_sheet_payload()

# ---------------- MAIN UI CONTENT ----------------
tab1, tab2 = st.tabs(["📋 Generated Plan", "⚙️ Raw Payload Preview"])

with tab2:
    st.subheader("Sheet JSON Payload")
    st.json(sheet_json)

with tab1:
    if st.button("🚀 Generate Diet Plan", type="primary"):
        request_body = {
            "sheet": sheet_json,
            "protein_level": protein_level,
            "meals": split_meals,
            "supplements": include_supplements
        }

        with st.spinner("Optimizing plan via FastAPI..."):
            try:
                res = requests.post(backend_url, json=request_body)
                if res.status_code == 200:
                    payload = res.json()
                    data = payload["data"]
                    validation = payload["validation"]

                    # Display automatic checks
                    if validation["passed"]:
                        st.success("AUTOMATIC CHECK: PASS (No diet/allergy/portion violations, targets met)")
                    else:
                        st.warning(f"AUTOMATIC CHECK ISSUES: {validation['problems']}")

                    # Meal-wise View
                    if split_meals and "meals" in data:
                        for meal_name, meal_data in data["meals"].items():
                            st.subheader(f"{meal_name.upper()} — {meal_data['kcal']} kcal (Target {meal_data['target_kcal']}), Protein {meal_data['protein']} g")
                            
                            rows = []
                            for f in meal_data["foods"]:
                                rows.append({
                                    "Food Item": f["name"],
                                    "Portion (g)": f["grams"],
                                    "State": f["state"],
                                    "Swaps": ", ".join(f["swaps"]) if f["swaps"] else "None"
                                })
                            st.dataframe(pd.DataFrame(rows), use_container_width=True)

                    # Whole-day View
                    elif "foods" in data:
                        st.subheader("RECOMMENDED FOODS (Whole Day)")
                        rows = [
                            {
                                "Food Item": f["name"],
                                "Portion (g)": f["grams"],
                                "State": f["state"],
                                "Swaps": ", ".join(f["swaps"]) if f["swaps"] else "None"
                            } for f in data["foods"]
                        ]
                        st.dataframe(pd.DataFrame(rows), use_container_width=True)

                    # Nutrient Breakdown
                    st.markdown("---")
                    st.subheader("Nutrient Targets vs Achieved")
                    
                    cov_rows = []
                    for k, got in data["totals"].items():
                        target_val = sheet_json["micronutrients"].get(k) or sheet_json.get(k) or "N/A"
                        if k in ["kcal", "fat", "fiber"]:
                            target_val = sheet_json.get("energy", {}).get("target_calories") if k == "kcal" else sheet_json.get("fat", {}).get("target_g") if k == "fat" else sheet_json.get("fiber_g")
                        elif k == "protein":
                            target_val = sheet_json["protein"][protein_level]["g"]
                        elif k == "carbs":
                            target_val = sheet_json["carbs_g"][protein_level]

                        pct = int(data["coverage"].get(k, 0) * 100)
                        cov_rows.append({
                            "Nutrient": k,
                            "Plan Value": got,
                            "Target Value": target_val,
                            "Coverage %": f"{pct}%"
                        })

                    st.table(pd.DataFrame(cov_rows))

                else:
                    st.error(f"Error {res.status_code}: {res.text}")
            except Exception as e:
                st.error(f"Could not connect to FastAPI server at {backend_url}. Make sure your uvicorn backend is running! ({str(e)})")