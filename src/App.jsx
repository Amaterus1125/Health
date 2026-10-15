import React, { useState, useCallback, useMemo } from "react";
import "./index.css";

const API_ENDPOINT = "http://localhost:8000/api/generate-plan";
const PDF_ENDPOINT = "http://localhost:8000/api/download-pdf";

export default function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [loading, setLoading] = useState(false);
  const [planData, setPlanData] = useState(null);
  const [errorMsg, setErrorMsg] = useState("");
  const [selectedMeal, setSelectedMeal] = useState(null);

  // Assessment Form State
  const [formData, setFormData] = useState({
    name: "Harshit",
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

  const handleChange = useCallback((e) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value
    }));
  }, []);

  const handleAssessmentSubmit = useCallback(async (e) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg("");

    try {
      const response = await fetch(API_ENDPOINT, {
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

      const data = await response.json();
      if (data.success) {
        setPlanData(data);
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

  if (!isLoggedIn) {
    return (
      <div className="app dark">
        <div className="food-background"></div>
        <div className="background-overlay"></div>
        <div className="modal-overlay" style={{ background: "transparent" }}>
          <div className="create-form glass" style={{ width: "620px", margin: "auto" }}>
            <div className="form-header">
              <div>
                <span>HEALTH ASSESSMENT PORTAL</span>
                <h2>Welcome to NutriFlow</h2>
                <p>Complete your biometric profile to generate your target macro balance and tailored Indian meal plan.</p>
              </div>
            </div>

            {errorMsg && <p style={{ color: "#ff7777", marginBottom: "15px", fontSize: "12px" }}>{errorMsg}</p>}

            <form onSubmit={handleAssessmentSubmit}>
              <div className="form-group full">
                <label>Full Name *</label>
                <input type="text" name="name" value={formData.name} onChange={handleChange} required />
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Age (Years)</label>
                  <input type="number" name="age" value={formData.age} onChange={handleChange} required />
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
            <span className="eyebrow">PERSONALIZED NUTRITIONAL SYSTEM</span>
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

        <section className="section-heading">
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
      </main>

      {/* FULL-VIEW MEAL MODAL */}
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
    </div>
  );
}