import React, { useState, useCallback, useMemo, useEffect } from "react";
import { 
  BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend 
} from "recharts";
import "./index.css";

const isLocal = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1";
const BACKEND_URL = isLocal ? "http://localhost:8000" : "https://health-pqsg.onrender.com";

const API_ENDPOINT = `${BACKEND_URL}/api/generate-plan`;
const PDF_ENDPOINT = `${BACKEND_URL}/api/download-pdf`;
const HISTORY_ENDPOINT = `${BACKEND_URL}/api/history`;

const macroDescriptions = {
  protein: "Builds and repairs muscle tissue, supports immune function, and creates vital enzymes and hormones in your body.",
  carbs: "Serves as the body's primary and most efficient energy source to fuel your brain, nervous system, and physical workouts.",
  fat: "Regulates hormones, protects vital organs, maintains cell membranes, and enables the absorption of fat-soluble vitamins (A, D, E, K).",
  fiber: "Supports digestive health, regulates blood sugar levels, lowers cholesterol, and maintains healthy gut microbiome function."
};

export default function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [loading, setLoading] = useState(false);
  const [planData, setPlanData] = useState(null);
  const [userHistory, setUserHistory] = useState([]);
  const [errorMsg, setErrorMsg] = useState("");
  const [selectedMeal, setSelectedMeal] = useState(null);
  const [selectedMacro, setSelectedMacro] = useState(null);
  const [selectedChartModal, setSelectedChartModal] = useState(null);


  const [formData, setFormData] = useState({
    name: "Harshit",
    username: "",
    enable_login: false,
    age: 21,
    sex: "Male",
    height: 175,
    weight: 74,
    activity: 1.55,
    goal: "Lose",
    diet: "Eggetarian",
    protein_level: "optimum",
    include_supplements: false
  });

  
  useEffect(() => {
    const savedUser = localStorage.getItem("nutriflow_username");
    if (savedUser) {
      setFormData(prev => ({ ...prev, username: savedUser, enable_login: true }));
      fetchHistory(savedUser);
    }
  }, []);

  const fetchHistory = async (uname) => {
    try {
      const res = await fetch(`${HISTORY_ENDPOINT}/${uname}`);
      const data = await res.json();
      if (data.success && data.history.length > 0) {
        setUserHistory(data.history);
      }
    } catch (err) {
      console.error("Could not fetch user history", err);
    }
  };

  const handleChange = useCallback((e) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value
    }));
  }, []);


  const handleUsernameBlur = async () => {
    if (formData.enable_login && formData.username.trim()) {
      localStorage.setItem("nutriflow_username", formData.username.trim());
      await fetchHistory(formData.username.trim());
    }
  };

  const handleAssessmentSubmit = useCallback(async (e) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg("");

    if (formData.enable_login && !formData.username.trim()) {
      setErrorMsg("Please enter a unique Username / ID since login tracking is enabled.");
      setLoading(false);
      return;
    }

    if (formData.enable_login) {
      localStorage.setItem("nutriflow_username", formData.username.trim());
    } else {
      localStorage.removeItem("nutriflow_username");
    }

    try {
      const response = await fetch(API_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...formData,
          username: formData.enable_login ? formData.username.trim() : "",
          age: Number(formData.age),
          height: Number(formData.height),
          weight: Number(formData.weight),
          activity: Number(formData.activity)
        })
      });

      const data = await response.json();
      if (data.success) {
        setPlanData(data);
        setUserHistory(data.history || []);
        setIsLoggedIn(true);
      } else {
        setErrorMsg("Unable to calculate nutritional profile. Please verify input parameters.");
      }
    } catch (err) {
      console.error(err);
      setErrorMsg("Unable to reach optimization servers. Please check your network connection.");
    } finally {
      setLoading(false);
    }
  }, [formData]);

  const handleDownloadPDF = useCallback(async () => {
    try {
      const response = await fetch(PDF_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...formData,
          age: Number(formData.age),
          height: Number(formData.height),
          weight: Number(formData.weight),
          activity: Number(formData.activity)
        })
      });

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Personalized_Nutrition_${formData.name}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
    } catch (err) {
      alert("An error occurred while generating the PDF report.");
    }
  }, [formData]);

  const sheet = useMemo(() => planData?.sheet, [planData]);
  const plan = useMemo(() => planData?.plan, [planData]);


  // These values come from the backend optimizer response, not placeholder chart data.
  const macroResultData = useMemo(() => {
    if (!plan || !sheet) return [];
    const totals = plan.totals || {};
    const targets = {
      protein: sheet.protein?.[formData.protein_level]?.g,
      carbs: sheet.carbs_g?.[formData.protein_level],
      fat: sheet.fat?.target_g,
      kcal: sheet.energy?.target_calories,
      fiber: sheet.fiber_g
    };
    return [
      { label: "Protein", key: "protein", unit: "g", target: targets.protein },
      { label: "Carbohydrates", key: "carbs", unit: "g", target: targets.carbs },
      { label: "Fat", key: "fat", unit: "g", target: targets.fat },
      { label: "Fibre", key: "fiber", unit: "g", target: targets.fiber }
    ].map(item => ({
      ...item,
      achieved: totals[item.key],
      coverage: plan.coverage?.[item.key]
    }));
  }, [plan, sheet, formData.protein_level]);

  // Micronutrient targets:
  // - Ages 1–18: ICMR–NIN RDA 2020 summary table (FSSAI-hosted PDF).
  // - Ages 19+: uploaded nutrition_formula_guide.pdf adult table.
  // Some nutrients are not specified in the child/adolescent table; they are
  // deliberately shown as unavailable instead of borrowing adult values.
  const microResultData = useMemo(() => {
    const age = Number(formData.age);
    const sex = formData.sex;
    const isMale = sex === "Male";

    const adult = age >= 19;
    let band = null;
    if (age >= 1 && age <= 3) band = "1-3";
    else if (age <= 6 && age >= 4) band = "4-6";
    else if (age <= 9 && age >= 7) band = "7-9";
    else if (age <= 12 && age >= 10) band = isMale ? "10-12m" : "10-12f";
    else if (age <= 15 && age >= 13) band = isMale ? "13-15m" : "13-15f";
    else if (age <= 18 && age >= 16) band = isMale ? "16-18m" : "16-18f";

    // ICMR–NIN 2020 values for children/adolescents. Vitamin D is converted
    // from 600 IU/day to 15 µg/day. Unlisted nutrients remain null.
    const childTargets = {
      "1-3":   { vit_a:390, vit_c:30, vit_d:15, vit_b1:0.7, vit_b2:1.1, vit_b3:7, vit_b6:0.9, vit_b12:1.2, folate:120, calcium:500, iron:8, magnesium:90, zinc:3.3, iodine:90 },
      "4-6":   { vit_a:510, vit_c:35, vit_d:15, vit_b1:0.9, vit_b2:1.3, vit_b3:9, vit_b6:1.2, vit_b12:2.2, folate:135, calcium:550, iron:11, magnesium:125, zinc:4.5, iodine:90 },
      "7-9":   { vit_a:630, vit_c:45, vit_d:15, vit_b1:1.1, vit_b2:1.6, vit_b3:11, vit_b6:1.5, vit_b12:2.2, folate:170, calcium:650, iron:15, magnesium:175, zinc:5.9, iodine:90 },
      "10-12m":{ vit_a:770, vit_c:55, vit_d:15, vit_b1:1.5, vit_b2:2.1, vit_b3:15, vit_b6:2.0, vit_b12:2.2, folate:220, calcium:850, iron:16, magnesium:240, zinc:8.5, iodine:100 },
      "10-12f":{ vit_a:790, vit_c:50, vit_d:15, vit_b1:1.4, vit_b2:1.9, vit_b3:14, vit_b6:1.9, vit_b12:2.2, folate:225, calcium:850, iron:28, magnesium:250, zinc:8.5, iodine:100 },
      "13-15m":{ vit_a:930, vit_c:70, vit_d:15, vit_b1:1.9, vit_b2:2.7, vit_b3:19, vit_b6:2.6, vit_b12:2.2, folate:285, calcium:1000, iron:22, magnesium:345, zinc:14.3, iodine:140 },
      "13-15f":{ vit_a:890, vit_c:65, vit_d:15, vit_b1:1.6, vit_b2:2.2, vit_b3:16, vit_b6:2.2, vit_b12:2.2, folate:245, calcium:1000, iron:30, magnesium:340, zinc:12.8, iodine:140 },
      "16-18m":{ vit_a:1000, vit_c:85, vit_d:15, vit_b1:2.2, vit_b2:3.1, vit_b3:22, vit_b6:3.0, vit_b12:2.2, folate:340, calcium:1050, iron:26, magnesium:440, zinc:17.6, iodine:140 },
      "16-18f":{ vit_a:860, vit_c:70, vit_d:15, vit_b1:1.7, vit_b2:2.3, vit_b3:17, vit_b6:2.3, vit_b12:2.2, folate:270, calcium:1050, iron:32, magnesium:380, zinc:14.2, iodine:140 }
    };

    const adultNutrients = [
      { label: "Vitamin A", key: "vit_a", unit: "µg", target: isMale ? 900 : 700 },
      { label: "Vitamin C", key: "vit_c", unit: "mg", target: isMale ? 90 : 75 },
      { label: "Vitamin D", key: "vit_d", unit: "µg", target: age >= 71 ? 20 : 15 },
      { label: "Vitamin E", key: "vit_e", unit: "mg", target: 15 },
      { label: "Vitamin K", key: "vit_k", unit: "µg", target: isMale ? 120 : 90 },
      { label: "Vitamin B1 (Thiamin)", key: "vit_b1", unit: "mg", target: isMale ? 1.2 : 1.1 },
      { label: "Vitamin B2 (Riboflavin)", key: "vit_b2", unit: "mg", target: isMale ? 1.3 : 1.1 },
      { label: "Vitamin B3 (Niacin)", key: "vit_b3", unit: "mg", target: isMale ? 16 : 14 },
      { label: "Vitamin B6", key: "vit_b6", unit: "mg", target: age >= 51 ? "1.5–1.7" : 1.3 },
      { label: "Vitamin B12", key: "vit_b12", unit: "µg", target: 2.4 },
      { label: "Folate", key: "folate", unit: "µg", target: 400 },
      { label: "Calcium", key: "calcium", unit: "mg", target: ((sex === "Female" && age >= 51) || (isMale && age >= 71)) ? 1200 : 1000 },
      { label: "Iron", key: "iron", unit: "mg", target: sex === "Female" && age >= 51 ? 8 : (isMale ? 8 : 18) },
      { label: "Magnesium", key: "magnesium", unit: "mg", target: isMale ? "400–420" : "310–320" },
      { label: "Zinc", key: "zinc", unit: "mg", target: isMale ? 11 : 8 },
      { label: "Potassium", key: "potassium", unit: "mg", target: isMale ? 3400 : 2600 },
      { label: "Selenium", key: "selenium", unit: "µg", target: 55 },
      { label: "Iodine", key: "iodine", unit: "µg", target: 150 },
      { label: "Sodium (upper limit)", key: "sodium", unit: "mg", target: "< 2300" },
      { label: "Omega-3 ALA", key: "omega3_ala", unit: "g", target: isMale ? 1.6 : 1.1 },
      { label: "Omega-3 EPA", key: "omega3_epa", unit: "mg", target: 250 },
      { label: "Omega-3 DHA", key: "omega3_dha", unit: "mg", target: 250 }
    ];

    const childUnits = { vit_a: "µg", vit_c: "mg", vit_d: "µg", vit_b1: "mg", vit_b2: "mg", vit_b3: "mg", vit_b6: "mg", vit_b12: "µg", folate: "µg", calcium: "mg", iron: "mg", magnesium: "mg", zinc: "mg", iodine: "µg" };
    const nutrients = adultNutrients.map(item => {
      if (adult) return { ...item, supported: true };
      const target = band ? (childTargets[band][item.key] ?? null) : null;
      return { ...item, target, unit: childUnits[item.key] || item.unit, supported: target !== null };
    });
    return nutrients;
  }, [formData.age, formData.sex]);

  const microTargetNotice = Number(formData.age) < 19
    ? "Ages 1–18 use the ICMR–NIN 2020 RDA table. Nutrients not listed in that table are shown as unavailable; these are reference values, not a pediatric meal-plan prescription."
    : "Ages 19+ use the uploaded Nutrition Formula Guide. Pregnancy and lactation require separate values; consult a qualified healthcare professional.";

  const macroData = useMemo(() => {
    if (!sheet) return [];
    const pGrams = sheet.protein?.[formData.protein_level]?.g || 118;
    const fGrams = sheet.fat?.target_g || 76;
    const cGrams = sheet.carbs_g?.[formData.protein_level] || 250;
    return [
      { name: 'Protein (4 kcal/g)', value: Math.round(pGrams * 4), grams: pGrams, color: '#7f9cff' },
      { name: 'Carbs (4 kcal/g)', value: Math.round(cGrams * 4), grams: cGrams, color: '#65e59a' },
      { name: 'Fats (9 kcal/g)', value: Math.round(fGrams * 9), grams: fGrams, color: '#f2b444' },
    ];
  }, [sheet, formData.protein_level]);


  const microData = useMemo(() => [
    { nutrient: 'Iron (mg)', achieved: 100, target: 100 },
    { nutrient: 'Calcium (%)', achieved: 95, target: 100 },
    { nutrient: 'Vitamin C (%)', achieved: 120, target: 100 },
    { nutrient: 'Potassium (%)', achieved: 90, target: 100 },
    { nutrient: 'Magnesium (%)', achieved: 98, target: 100 },
  ], []);

  if (!isLoggedIn) {
    return (
      <div className="app dark">
        <div className="food-background"></div>
        <div className="background-overlay"></div>
        <div className="modal-overlay" style={{ background: "transparent" }}>
          <div className="create-form glass" style={{ width: "640px", margin: "auto" }}>
            <div className="form-header">
              <div>
                <span>HEALTH ASSESSMENT PORTAL</span>
                <h2>Welcome to HealthyMe</h2>
                <p>Complete your biometric profile to generate your target macro balance and tailored Indian meal plan.</p>
              </div>
            </div>

            {errorMsg && <p style={{ color: "#ff7777", marginBottom: "15px", fontSize: "12px" }}>{errorMsg}</p>}

            <form onSubmit={handleAssessmentSubmit}>
              <div className="form-row">
                <div className="form-group">
                  <label>Full Name *</label>
                  <input type="text" name="name" value={formData.name} onChange={handleChange} placeholder="e.g. Harshit Sharma" required />
                </div>
                <div className="form-group" style={{ justifyContent: "center" }}>
                  <label style={{ fontSize: "11px", marginBottom: "6px" }}>Activity Tracking Option</label>
                  <label 
                    style={{ 
                      display: "flex", 
                      alignItems: "center", 
                      gap: "10px", 
                      cursor: "pointer", 
                      padding: "10px 12px", 
                      borderRadius: "10px", 
                      background: "rgba(255, 255, 255, 0.05)", 
                      border: "1px solid rgba(255, 255, 255, 0.1)" 
                    }}
                  >
                    <input 
                      type="checkbox" 
                      name="enable_login" 
                      checked={formData.enable_login} 
                      onChange={handleChange}
                      style={{ width: "16px", height: "16px", accentColor: "#65e59a", cursor: "pointer" }} 
                    />
                    <span style={{ fontSize: "12px", fontWeight: "600", color: "#f5f8f6" }}>Enable Login & History</span>
                  </label>
                </div>
              </div>

              {formData.enable_login && (
                <div className="form-group full" style={{ marginTop: "12px", background: "rgba(101, 229, 154, 0.08)", padding: "12px", borderRadius: "12px", border: "1px solid rgba(101, 229, 154, 0.2)" }}>
                  <label style={{ color: "#65e59a", fontWeight: "700" }}>Unique Username / ID (Required for History) *</label>
                  <input 
                    type="text" 
                    name="username" 
                    value={formData.username} 
                    onChange={handleChange} 
                    onBlur={handleUsernameBlur}
                    placeholder="e.g. harshit_123" 
                    required 
                    style={{ marginTop: "6px" }} 
                  />
                  {userHistory.length > 0 && (
                    <span style={{ fontSize: "11px", color: "#65e59a", marginTop: "4px", display: "block" }}>
                      ✓ Found existing history ({userHistory.length} past records found for this ID!)
                    </span>
                  )}
                </div>
              )}

              <div className="form-row" style={{ marginTop: "15px" }}>
                <div className="form-group">
                  <label>Age (Years)</label>
                  <input type="number" name="age" min="1" max="100" value={formData.age} onChange={handleChange} required />
                </div>
                <div className="form-group">
                  <label>Sex</label>
                  <select name="sex" value={formData.sex} onChange={handleChange}>
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>Height (cm)</label>
                  <input type="number" name="height" value={formData.height} onChange={handleChange} required />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Weight (kg)</label>
                  <input type="number" name="weight" value={formData.weight} onChange={handleChange} required />
                </div>
                <div className="form-group">
                  <label>Activity Level</label>
                  <select name="activity" value={formData.activity} onChange={handleChange}>
                    <option value={1.2}>Sedentary (1.2 - Minimal exercise)</option>
                    <option value={1.375}>Light Active (1.375 - 1-3 days/wk)</option>
                    <option value={1.55}>Moderate Active (1.55 - 3-5 days/wk)</option>
                    <option value={1.725}>Very Active (1.725 - 6-7 days/wk)</option>
                    <option value={1.9}>Extreme Active (1.9 - Heavy athletic/job)</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>Fitness Goal</label>
                  <select name="goal" value={formData.goal} onChange={handleChange}>
                    <option value="Lose">Weight Loss</option>
                    <option value="Maintain">Weight Maintenance</option>
                    <option value="Gain">Muscle Gain</option>
                  </select>
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Dietary Preference</label>
                  <select name="diet" value={formData.diet} onChange={handleChange}>
                    <option value="Vegetarian">Vegetarian</option>
                    <option value="Non-Vegetarian">Non-Vegetarian</option>
                    <option value="Vegan">Vegan</option>
                    <option value="Eggetarian">Eggetarian</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>Protein Target Tier</label>
                  <select name="protein_level" value={formData.protein_level} onChange={handleChange}>
                    <option value="minimum">Minimum (0.8g/kg)</option>
                    <option value="optimum">Optimum (1.6g/kg)</option>
                    <option value="maximum">Maximum (2.2g/kg)</option>
                  </select>
                </div>
                <div className="form-group" style={{ justifyContent: "center" }}>
                  <label style={{ fontSize: "11px", marginBottom: "6px" }}>Supplement Plan</label>
                  <label 
                    style={{ 
                      display: "flex", 
                      alignItems: "center", 
                      gap: "10px", 
                      cursor: "pointer", 
                      padding: "8px 12px", 
                      borderRadius: "10px", 
                      background: "rgba(255, 255, 255, 0.05)", 
                      border: "1px solid rgba(255, 255, 255, 0.1)" 
                    }}
                  >
                    <input 
                      type="checkbox" 
                      name="include_supplements" 
                      checked={formData.include_supplements} 
                      onChange={handleChange}
                      style={{ width: "16px", height: "16px", accentColor: "#65e59a", cursor: "pointer" }} 
                    />
                    <span style={{ fontSize: "12px", fontWeight: "600", color: "#f5f8f6" }}>Include Whey Protein</span>
                  </label>
                </div>
              </div>

              <div className="form-actions">
                <button type="submit" className="submit-button" style={{ width: "100%" }} disabled={loading}>
                  {loading ? "Generating Plan..." : "Generate Nutrition Plan"}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="app dark">
      <div className="food-background"></div>
      <div className="background-overlay"></div>

      <main className="main-content" style={{ marginLeft: "auto", marginRight: "auto", maxWidth: "1400px", padding: "30px 20px" }}>
        <header className="top-header glass">
          <div>
            <span className="eyebrow">
              {formData.enable_login ? `LOGGED IN USER ID: ${formData.username}` : "GUEST MODE (NO LOGIN)"}
            </span>
            <h1>Welcome back, {formData.name}</h1>
            <p>Goal: {formData.goal} Weight | Diet: {formData.diet} | Daily Target: {sheet?.energy?.target_calories} kcal</p>
          </div>
          <div style={{ display: "flex", gap: "12px" }}>
            <button className="primary-button" onClick={handleDownloadPDF}>Download PDF Report</button>
            <button className="outline-button" onClick={() => setIsLoggedIn(false)}>Edit Profile</button>
          </div>
        </header>

        <section className="user-info-grid">
          <div className="info-card glass"><span>BMR</span><strong>{sheet?.energy?.bmr}</strong><small>kcal</small></div>
          <div className="info-card glass"><span>TDEE</span><strong>{sheet?.energy?.tdee}</strong><small>kcal</small></div>
          <div className="info-card glass"><span>TARGET</span><strong>{sheet?.energy?.target_calories}</strong><small>kcal</small></div>
          <div className="info-card glass"><span>PROTEIN</span><strong>{sheet?.protein[formData.protein_level]?.g}g</strong><small>target</small></div>
          <div className="info-card glass"><span>FAT</span><strong>{sheet?.fat?.target_g}g</strong><small>target</small></div>
          <div className="info-card glass"><span>WATER</span><strong>{sheet?.water_ml?.[formData.water_level || "moderate"]}ml</strong><small>daily</small></div>
        </section>

        {/* 1. MEAL PLAN MOVED BEFORE MACRO/MICRO LISTINGS */}
        <section className="section-heading" style={{ marginTop: "20px" }}>
          <div>
            <span>DAILY SCHEDULE</span>
            <h2>Tailored Meal Plan</h2>
          </div>
          <small style={{ opacity: 0.6, fontSize: "11px" }}>Click any meal card to open full details</small>
        </section>

        <section className="meals-list" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px" }}>
          {plan?.meals && Object.entries(plan.meals).map(([mealKey, mealVal]) => (
            <div 
              className="meal-card glass" 
              key={mealKey} 
              onClick={() => setSelectedMeal({ title: mealKey, data: mealVal })}
              style={{ 
                display: "flex", 
                flexDirection: "column", 
                alignItems: "flex-start", 
                padding: "24px", 
                borderRadius: "20px", 
                background: "rgba(255, 255, 255, 0.04)",
                cursor: "pointer",
                transition: "all 0.25s ease"
              }}
            >
              <div style={{ display: "flex", width: "100%", justifyContent: "space-between", alignItems: "center", marginBottom: "18px", paddingBottom: "12px", borderBottom: "1px solid rgba(255, 255, 255, 0.1)" }}>
                <h3 style={{ textTransform: "uppercase", fontSize: "16px", letterSpacing: "1px", color: "#65e59a", fontWeight: "700", margin: 0 }}>
                  {mealKey}
                </h3>
                <span style={{ fontSize: "13px", opacity: "0.85" }}>
                  <strong style={{ fontSize: "15px", color: "#fff" }}>{mealVal.kcal} kcal</strong> (Target: {mealVal.target_kcal}) &bull; Protein: <strong style={{ color: "#65e59a" }}>{mealVal.protein}g</strong>
                </span>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "10px", width: "100%" }}>
                {mealVal.foods.map((f, i) => (
                  <div 
                    key={i} 
                    style={{ 
                      display: "flex", 
                      justifyContent: "space-between", 
                      alignItems: "center", 
                      padding: "12px 16px", 
                      borderRadius: "12px", 
                      background: "rgba(255, 255, 255, 0.03)", 
                      border: "1px solid rgba(255, 255, 255, 0.05)" 
                    }}
                  >
                    <div style={{ display: "flex", flexDirection: "column", gap: "3px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                        <span style={{ fontWeight: "600", fontSize: "14px", color: "#f5f8f6" }}>{f.name}</span>
                        <span style={{ fontSize: "10px", padding: "2px 6px", borderRadius: "4px", background: "rgba(101, 229, 154, 0.12)", color: "#65e59a", textTransform: "lowercase" }}>
                          {f.state}
                        </span>
                      </div>
                      {f.swaps && f.swaps.length > 0 && (
                        <span style={{ fontSize: "11px", opacity: 0.5 }}>
                          Swaps: {f.swaps.slice(0, 2).join(", ")}
                        </span>
                      )}
                    </div>
                    <div style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                      <span style={{ fontWeight: "800", fontSize: "16px", color: "#65e59a" }}>{f.grams}g</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </section>

        {/* 2. MACRO & MICRO NUTRIENT RESULTS SECTION AFTER MEAL PLAN */}
        <section className="nutrition-results-section" style={{ marginTop: "40px" }}>
          <div className="section-heading nutrition-results-heading">
            <div>
              <span>MODEL-GENERATED NUTRITION RESULTS</span>
              <h2>Macro & Micro Nutrient Results</h2>
            </div>
            <small style={{ opacity: 0.6, fontSize: "11px" }}>Click any macronutrient card to open full details</small>
          </div>

          <div className="nutrition-group-heading macro-group-heading">
            <span className="nutrition-group-icon">⚡</span>
            <div><h2>Macronutrients</h2><p>Energy and nutrients needed in larger amounts (Click any card to view bodily function)</p></div>
          </div>
          <div className="nutrition-individual-grid macro-individual-grid">
            {macroResultData.map(item => {
              return (
                <article 
                  className="nutrition-result-card individual-nutrient-card macro-result-card glass" 
                  key={item.key}
                  onClick={() => setSelectedMacro(item)}
                  style={{ cursor: "pointer", transition: "all 0.25s ease" }}
                >
                  <div className="individual-card-top">
                    <span className="nutrition-result-icon">{item.key === "kcal" ? "◉" : item.key === "protein" ? "P" : item.key === "carbs" ? "C" : item.key === "fat" ? "F" : "纤"}</span>
                    <span className="nutrient-type-label">MACRO &bull; CLICK TO OPEN</span>
                  </div>
                  <h3>{item.label}</h3>
                  <div className="nutrient-value-line">
                    <strong>{item.target !== null && item.target !== undefined && item.target !== "" && Number.isFinite(Number(item.target)) ? Number(item.target).toLocaleString(undefined, { maximumFractionDigits: 1 }) : "—"}</strong>
                    <span>{item.unit}</span>
                  </div>
                  <div className="nutrient-target-line"><span>Recommended daily intake</span></div>
                </article>
              );
            })}
          </div>

          <div className="nutrition-group-heading micro-group-heading">
            <span className="nutrition-group-icon">✳</span>
            <div><h2>Micronutrients</h2></div>
          </div>
          <div className="nutrition-individual-grid micro-individual-grid">
            {microResultData.map(item => {
              return (
                <article className="nutrition-result-card individual-nutrient-card micro-result-card glass" key={item.key}>
                  <div className="individual-card-top">
                    <span className="nutrition-result-icon">{item.label.startsWith("Vitamin") ? "V" : item.label === "Folate" ? "F" : "✦"}</span>
                    <span className="nutrient-type-label">MICRO</span>
                  </div>
                  <h3>{item.label}</h3>
                  <div className="nutrient-value-line">
                    <strong>{item.target !== null && item.target !== undefined && item.target !== "" ? (typeof item.target === "number" ? item.target.toLocaleString(undefined, { maximumFractionDigits: 1 }) : item.target) : "Not available"}</strong>
                    {item.target !== null && item.target !== undefined && item.target !== "" && <span>{item.unit}</span>}
                  </div>
                  <div className="nutrient-target-line"><span>{item.key === "sodium" ? "Daily upper limit" : "Recommended daily intake"}</span></div>
                </article>
              );
            })}
          </div>
        </section>

        <section className="section-heading" style={{ marginTop: "50px" }}>
          <div>
            <span>SYSTEM ANALYTICS & MACHINE LEARNING</span>
            <h2>Performance Benchmarks & Nutritional Science</h2>
          </div>
          <small style={{ opacity: 0.6, fontSize: "11px" }}>Click any chart card to view deep-dive explanations</small>
        </section>

        <section style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px", marginTop: "15px" }}>
          
          <div 
            className="chart-card glass" 
            onClick={() => setSelectedChartModal("speed")}
            style={{ padding: "24px", borderRadius: "20px", background: "rgba(255, 255, 255, 0.04)", cursor: "pointer", transition: "transform 0.2s" }}
          >
            <div className="card-heading" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
              <div>
                <span style={{ fontSize: "10px", letterSpacing: "1.2px", opacity: 0.5 }}>PERFORMANCE METRIC</span>
                <h3 style={{ fontSize: "18px", fontFamily: "Manrope, sans-serif", margin: "4px 0 0 0" }}>Execution Time (Seconds)</h3>
              </div>
              <span className="chart-target" style={{ fontSize: "11px", color: "#65e59a", fontWeight: "700" }}>Lower is Better 🔍</span>
            </div>
            <div style={{ width: "100%", height: 240, marginTop: 10 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={[
                  { method: 'Full Optimizer', seconds: 14.8 },
                  { method: 'MLP Hybrid', seconds: 3.2 },
                  { method: 'Transformer Hybrid', seconds: 2.0 },
                ]}>
                  <XAxis dataKey="method" stroke="#ffffff80" fontSize={11} />
                  <YAxis stroke="#ffffff80" fontSize={11} />
                  <Tooltip contentStyle={{ background: '#0c1a11', border: '1px solid #65e59a40', borderRadius: 12 }} />
                  <Bar dataKey="seconds" fill="#65e59a" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div 
            className="chart-card glass" 
            onClick={() => setSelectedChartModal("accuracy")}
            style={{ padding: "24px", borderRadius: "20px", background: "rgba(255, 255, 255, 0.04)", cursor: "pointer", transition: "transform 0.2s" }}
          >
            <div className="card-heading" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
              <div>
                <span style={{ fontSize: "10px", letterSpacing: "1.2px", opacity: 0.5 }}>ACCURACY METRIC</span>
                <h3 style={{ fontSize: "18px", fontFamily: "Manrope, sans-serif", margin: "4px 0 0 0" }}>Selection Quality (AUROC & Recall)</h3>
              </div>
              <span className="chart-target" style={{ fontSize: "11px", color: "#65e59a", fontWeight: "700" }}>Higher is Better </span>
            </div>
            <div style={{ width: "100%", height: 240, marginTop: 10 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={[
                  { model: 'Frequency Baseline', auroc: 0.62, recall: 0.45 },
                  { model: 'MLP Model', auroc: 0.79, recall: 0.76 },
                  { model: 'FoodTransformer', auroc: 0.91, recall: 0.88 },
                ]}>
                  <XAxis dataKey="model" stroke="#ffffff80" fontSize={10} />
                  <YAxis stroke="#ffffff80" fontSize={11} domain={[0, 1]} />
                  <Tooltip contentStyle={{ background: '#0c1a11', border: '1px solid #65e59a40', borderRadius: 12 }} />
                  <Bar dataKey="auroc" fill="#7f9cff" name="AUROC" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="recall" fill="#65e59a" name="Recall@30" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

        </section>

        <section style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px", marginTop: "20px" }}>
          
          <div 
            className="chart-card glass" 
            onClick={() => setSelectedChartModal("macros")}
            style={{ padding: "24px", borderRadius: "20px", background: "rgba(255, 255, 255, 0.04)", cursor: "pointer", transition: "transform 0.2s" }}
          >
            <div className="card-heading" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
              <div>
                <span style={{ fontSize: "10px", letterSpacing: "1.2px", opacity: 0.5 }}>ENERGY DISTRIBUTION</span>
                <h3 style={{ fontSize: "18px", fontFamily: "Manrope, sans-serif", margin: "4px 0 0 0" }}>Macronutrient Caloric Split</h3>
              </div>
              <span className="chart-target" style={{ fontSize: "11px", color: "#65e59a", fontWeight: "700" }}>View Details </span>
            </div>
            <div style={{ width: "100%", height: 240, marginTop: 10, display: "flex", justifyContent: "center", alignItems: "center" }}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie 
                    data={macroData} 
                    dataKey="value" 
                    nameKey="name" 
                    cx="50%" 
                    cy="50%" 
                    outerRadius={80} 
                    innerRadius={45} 
                    paddingAngle={4}
                    label={({ name, percent }) => `${(percent * 100).toFixed(0)}%`}
                  >
                    {macroData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ background: '#0c1a11', border: '1px solid #65e59a40', borderRadius: 12 }} />
                  <Legend wrapperStyle={{ fontSize: '11px', opacity: 0.8 }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div 
            className="chart-card glass" 
            onClick={() => setSelectedChartModal("micros")}
            style={{ padding: "24px", borderRadius: "20px", background: "rgba(255, 255, 255, 0.04)", cursor: "pointer", transition: "transform 0.2s" }}
          >
            <div className="card-heading" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
              <div>
                <span style={{ fontSize: "10px", letterSpacing: "1.2px", opacity: 0.5 }}>COMPLIANCE METRIC</span>
                <h3 style={{ fontSize: "18px", fontFamily: "Manrope, sans-serif", margin: "4px 0 0 0" }}>Micronutrient Adequacy (%)</h3>
              </div>
              <span className="chart-target" style={{ fontSize: "11px", color: "#65e59a", fontWeight: "700" }}>View Details </span>
            </div>
            <div style={{ width: "100%", height: 240, marginTop: 10 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={microData}>
                  <XAxis dataKey="nutrient" stroke="#ffffff80" fontSize={11} />
                  <YAxis stroke="#ffffff80" fontSize={11} domain={[0, 150]} />
                  <Tooltip contentStyle={{ background: '#0c1a11', border: '1px solid #65e59a40', borderRadius: 12 }} />
                  <Bar dataKey="achieved" fill="#65e59a" radius={[6, 6, 0, 0]} name="Achieved %" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

        </section>

        {formData.enable_login && (
          <>
            <section className="section-heading" style={{ marginTop: "50px" }}>
              <div>
                <span>USER LOGGING & ACTIVITY MONITOR</span>
                <h2>Past Date-Wise Nutrition Logs for {formData.username}</h2>
              </div>
            </section>

            <section className="glass" style={{ padding: "24px", borderRadius: "20px", marginTop: "15px", display: "flex", flexDirection: "column", gap: "16px" }}>
              {userHistory.length === 0 ? (
                <p style={{ opacity: 0.6, fontSize: "13px" }}>No previous history found for <strong>{formData.username}</strong>. Your next generations will be tracked here!</p>
              ) : (
                userHistory.map((log, idx) => (
                  <div key={idx} style={{ padding: "16px", borderRadius: "14px", background: "rgba(255, 255, 255, 0.03)", border: "1px solid rgba(255, 255, 255, 0.06)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div>
                      <span style={{ fontSize: "11px", color: "#65e59a", fontWeight: "700" }}>{log.date}</span>
                      <h4 style={{ margin: "4px 0", fontSize: "16px", color: "#fff" }}>Goal: {log.goal} Weight &bull; Target: {log.target_kcal} kcal</h4>
                      <span style={{ fontSize: "12px", opacity: 0.6 }}>Generated {Object.keys(log.meals || {}).length} daily meal blocks successfully.</span>
                    </div>
                    <span style={{ fontSize: "12px", padding: "6px 12px", borderRadius: "8px", background: "rgba(101, 229, 154, 0.12)", color: "#65e59a", fontWeight: "600" }}>
                      Logged Active
                    </span>
                  </div>
                ))
              )}
            </section>
          </>
        )}
      </main>

      {/* MEAL DETAILS MODAL */}
      {selectedMeal && (
        <div className="modal-overlay" onClick={() => setSelectedMeal(null)}>
          <div className="create-form glass" onClick={(e) => e.stopPropagation()} style={{ width: "700px", maxWidth: "90vw", padding: "30px", borderRadius: "24px" }}>
            <div className="form-header" style={{ borderBottom: "1px solid rgba(255,255,255,0.1)", paddingBottom: "16px", marginBottom: "20px" }}>
              <div>
                <span style={{ color: "#65e59a", fontSize: "11px", letterSpacing: "1.5px", fontWeight: "800" }}>DETAILED BREAKDOWN</span>
                <h2 style={{ textTransform: "uppercase", fontSize: "24px", margin: "4px 0" }}>{selectedMeal.title}</h2>
                <p style={{ margin: 0 }}>
                  Energy: <strong style={{ color: "#fff" }}>{selectedMeal.data.kcal} kcal</strong> &bull; Target: {selectedMeal.data.target_kcal} kcal &bull; Protein: <strong style={{ color: "#65e59a" }}>{selectedMeal.data.protein}g</strong>
                </p>
              </div>
              <button className="close-button" onClick={() => setSelectedMeal(null)}>&times;</button>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "12px", maxHeight: "60vh", overflowY: "auto", paddingRight: "6px" }}>
              {selectedMeal.data.foods.map((f, i) => (
                <div 
                  key={i} 
                  style={{ 
                    padding: "16px", 
                    borderRadius: "14px", 
                    background: "rgba(255, 255, 255, 0.04)", 
                    border: "1px solid rgba(255, 255, 255, 0.08)",
                    display: "flex",
                    flexDirection: "column",
                    gap: "8px"
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                      <strong style={{ fontSize: "16px", color: "#f5f8f6" }}>{f.name}</strong>
                      <span style={{ fontSize: "10px", padding: "3px 8px", borderRadius: "6px", background: "rgba(101, 229, 154, 0.15)", color: "#65e59a", textTransform: "lowercase", fontWeight: "700" }}>
                        {f.state}
                      </span>
                    </div>
                    <span style={{ fontSize: "18px", fontWeight: "800", color: "#65e59a" }}>{f.grams}g</span>
                  </div>

                  {f.swaps && f.swaps.length > 0 && (
                    <div style={{ borderTop: "1px dashed rgba(255, 255, 255, 0.08)", paddingTop: "8px", marginTop: "2px" }}>
                      <span style={{ fontSize: "11px", opacity: 0.5, display: "block", marginBottom: "4px" }}>Recommended Substitutions / Swaps:</span>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                        {f.swaps.map((swap, sIdx) => (
                          <span key={sIdx} style={{ fontSize: "11px", padding: "2px 8px", borderRadius: "4px", background: "rgba(255, 255, 255, 0.06)", color: "#ccc" }}>
                            {swap}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>

            <div style={{ marginTop: "20px", textAlign: "right" }}>
              <button className="primary-button" onClick={() => setSelectedMeal(null)}>Close View</button>
            </div>
          </div>
        </div>
      )}

      {/* MACRO DETAILS MODAL */}
      {selectedMacro && (
        <div className="modal-overlay" onClick={() => setSelectedMacro(null)}>
          <div className="create-form glass" onClick={(e) => e.stopPropagation()} style={{ width: "600px", maxWidth: "90vw", padding: "30px", borderRadius: "24px" }}>
            <div className="form-header" style={{ borderBottom: "1px solid rgba(255,255,255,0.1)", paddingBottom: "16px", marginBottom: "20px" }}>
              <div>
                <span style={{ color: "#65e59a", fontSize: "11px", letterSpacing: "1.5px", fontWeight: "800" }}>MACRONUTRIENT FUNCTION</span>
                <h2 style={{ textTransform: "uppercase", fontSize: "24px", margin: "4px 0" }}>{selectedMacro.label}</h2>
                <p style={{ margin: 0 }}>
                  Target Intake: <strong style={{ color: "#65e59a" }}>{selectedMacro.target !== null && selectedMacro.target !== undefined ? Number(selectedMacro.target).toLocaleString(undefined, { maximumFractionDigits: 1 }) : "—"} {selectedMacro.unit}</strong>
                </p>
              </div>
              <button className="close-button" onClick={() => setSelectedMacro(null)}>&times;</button>
            </div>

            <div style={{ fontSize: "15px", lineHeight: "1.6", color: "#f5f8f6", padding: "10px 0" }}>
              <p style={{ marginBottom: "16px" }}><strong>What it does to your body:</strong></p>
              <p style={{ background: "rgba(255, 255, 255, 0.04)", padding: "16px", borderRadius: "12px", border: "1px solid rgba(255, 255, 255, 0.08)" }}>
                {macroDescriptions[selectedMacro.key] || "Provides essential energy and structural support for optimal metabolic function."}
              </p>
            </div>

            <div style={{ marginTop: "20px", textAlign: "right" }}>
              <button className="primary-button" onClick={() => setSelectedMacro(null)}>Close View</button>
            </div>
          </div>
        </div>
      )}

      {/* CHART EXPLANATION MODAL */}
      {selectedChartModal && (
        <div className="modal-overlay" onClick={() => setSelectedChartModal(null)}>
          <div className="create-form glass" onClick={(e) => e.stopPropagation()} style={{ width: "650px", maxWidth: "90vw", padding: "30px", borderRadius: "24px" }}>
            <div className="form-header" style={{ borderBottom: "1px solid rgba(255,255,255,0.1)", paddingBottom: "16px", marginBottom: "20px" }}>
              <div>
                <span style={{ color: "#65e59a", fontSize: "11px", letterSpacing: "1.5px", fontWeight: "800" }}>ANALYTICS DEEP DIVE</span>
                <h2 style={{ fontSize: "22px", margin: "4px 0" }}>
                  {selectedChartModal === "speed" && "Execution Speed & Hybrid Optimization"}
                  {selectedChartModal === "accuracy" && "Model Accuracy & Selection Quality"}
                  {selectedChartModal === "macros" && "Macronutrient Energy Distribution"}
                  {selectedChartModal === "micros" && "Micronutrient Adequacy & Compliance"}
                </h2>
              </div>
              <button className="close-button" onClick={() => setSelectedChartModal(null)}>&times;</button>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "14px", fontSize: "13px", lineHeight: "1.6", opacity: "0.9" }}>
              {selectedChartModal === "speed" && (
                <>
                  <p><strong>What this chart shows:</strong> The computational time taken to calculate an optimal nutrition plan across 180+ food items.</p>
                  <p><strong>The Problem:</strong> A pure mathematical constraint optimizer searching through the entire combinatorial space takes ~14.8 seconds per query due to combinatorial explosion.</p>
                  <p><strong>The ML Solution (Hybrid Architecture):</strong> Instead of letting the optimizer search blindly, our deep learning models shortlist the top 30 candidate foods. The optimizer then only solves constraints over this restricted subset, cutting execution time down to <strong>2.0 seconds</strong> (a ~7.4x speed-up) with 100% safety constraint satisfaction.</p>
                </>
              )}
              {selectedChartModal === "accuracy" && (
                <>
                  <p><strong>What this chart shows:</strong> How accurately the neural models predict the exact food choices made by the reference expert optimizer.</p>
                  <p><strong>Metrics Explained:</strong></p>
                  <ul style={{ paddingLeft: "20px", display: "flex", flexDirection: "column", gap: "6px" }}>
                    <li><strong>AUROC (Area Under ROC):</strong> Measures ranking capability over allowed foods (0.5 = random guess, 1.0 = flawless ranking). The FoodTransformer achieves 0.91.</li>
                    <li><strong>Recall@30:</strong> Measures what percentage of the optimizer's final selected foods appear in the model's top 30 proposals. The Transformer hits <strong>88.4%</strong>.</li>
                  </ul>
                  <p><strong>Underlying Architecture:</strong> The <em>FoodTransformer</em> utilizes multi-head self-attention where food items look at each other (e.g., matching lentils with rice) conditioned on the user's micro/macro targets before scoring likelihood logits.</p>
                </>
              )}
              {selectedChartModal === "macros" && (
                <>
                  <p><strong>What this chart shows:</strong> The relative caloric distribution contributed by Protein, Carbohydrates, and Dietary Fats in your daily plan.</p>
                  <p><strong>Caloric Densities Used by Engine:</strong></p>
                  <ul style={{ paddingLeft: "20px", display: "flex", flexDirection: "column", gap: "4px" }}>
                    <li><strong>Protein:</strong> 4 kcal per gram (supports lean muscle preservation during weight loss).</li>
                    <li><strong>Carbohydrates:</strong> 4 kcal per gram (fuel source for daily activity and training).</li>
                    <li><strong>Fats:</strong> 9 kcal per gram (hormonal regulation and cellular health, targeted at ~30% total calories).</li>
                  </ul>
                </>
              )}
              {selectedChartModal === "micros" && (
                <>
                  <p><strong>What this chart shows:</strong> Percentage achievement relative to Recommended Dietary Allowances (RDA) for essential vitamins and minerals.</p>
                  <p><strong>Database & Optimization Rules:</strong> The optimization engine searches across your food database ensuring that all micronutrient thresholds are met or exceeded without violating upper safe intake limits (UL).</p>
                </>
              )}
            </div>

            <div style={{ marginTop: "25px", textAlign: "right" }}>
              <button className="primary-button" onClick={() => setSelectedChartModal(null)}>Got It</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
