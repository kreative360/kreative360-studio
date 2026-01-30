"use client";

import { useState, useEffect } from "react";

type Template = {
  id: string;
  title: string;
  template: string;
  category: string;
  variables: string[];
};

type Variable = {
  id: string;
  variable_name: string;
  display_name: string;
  variable_type: string;
  possible_values: string[];
  default_value: string;
  description: string;
};

export default function AdaptivePromptsPage() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [variables, setVariables] = useState<Variable[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);
  const [variableValues, setVariableValues] = useState<Record<string, string>>({});
  const [generatedPrompt, setGeneratedPrompt] = useState<string>("");
  
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      
      const [templatesRes, variablesRes] = await Promise.all([
        fetch("/api/adaptive-prompts/templates"),
        fetch("/api/adaptive-prompts/variables"),
      ]);

      const templatesData = await templatesRes.json();
      const variablesData = await variablesRes.json();

      if (templatesData.success) {
        setTemplates(templatesData.templates);
        setCategories(templatesData.categories);
      }

      if (variablesData.success) {
        setVariables(variablesData.variables);
      }
    } catch (error) {
      console.error("Error loading data:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleTemplateSelect = (template: Template) => {
    setSelectedTemplate(template);
    setGeneratedPrompt("");

    const initialValues: Record<string, string> = {};
    
    template.variables.forEach((varName) => {
      const varDef = variables.find((v) => v.variable_name === varName);
      if (varDef) {
        initialValues[varName] = varDef.default_value || "";
      }
    });

    setVariableValues(initialValues);
  };

  const generatePrompt = async () => {
    if (!selectedTemplate) return;

    setGenerating(true);

    try {
      const res = await fetch("/api/adaptive-prompts/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          templateId: selectedTemplate.id,
          variables: variableValues,
          saveToHistory: true,
        }),
      });

      const data = await res.json();

      if (data.success) {
        setGeneratedPrompt(data.prompt);
      } else {
        alert("Error generando prompt: " + data.error);
      }
    } catch (error) {
      console.error("Error:", error);
      alert("Error generando prompt");
    } finally {
      setGenerating(false);
    }
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(generatedPrompt);
    alert("✅ Prompt copiado al portapapeles");
  };

  const filteredTemplates = selectedCategory
    ? templates.filter((t) => t.category === selectedCategory)
    : templates;

  return (
    <div style={{ minHeight: "100vh", background: "#f9fafb", padding: 24 }}>
      <div style={{ maxWidth: 1400, margin: "0 auto", marginBottom: 32 }}>
        <h1 style={{ fontSize: 32, fontWeight: 800, color: "#ff6b6b", marginBottom: 8 }}>
          Prompts Adaptativos
        </h1>
        <p style={{ fontSize: 16, color: "#6b7280" }}>
          Crea prompts personalizados usando plantillas con variables dinámicas
        </p>
      </div>

      {loading ? (
        <div style={{ textAlign: "center", padding: 80, color: "#6b7280" }}>
          Cargando plantillas...
        </div>
      ) : (
        <div style={{ maxWidth: 1400, margin: "0 auto", display: "grid", gridTemplateColumns: "1fr 2fr", gap: 24 }}>
          <div>
            <div style={{ marginBottom: 16 }}>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <button
                  onClick={() => setSelectedCategory(null)}
                  style={{
                    padding: "8px 16px",
                    background: selectedCategory === null ? "#ff6b6b" : "#fff",
                    color: selectedCategory === null ? "#fff" : "#374151",
                    border: "1px solid #e5e7eb",
                    borderRadius: 8,
                    fontWeight: 600,
                    fontSize: 13,
                    cursor: "pointer",
                  }}
                >
                  Todas
                </button>
                {categories.map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setSelectedCategory(cat)}
                    style={{
                      padding: "8px 16px",
                      background: selectedCategory === cat ? "#ff6b6b" : "#fff",
                      color: selectedCategory === cat ? "#fff" : "#374151",
                      border: "1px solid #e5e7eb",
                      borderRadius: 8,
                      fontWeight: 600,
                      fontSize: 13,
                      cursor: "pointer",
                      textTransform: "capitalize",
                    }}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {filteredTemplates.map((template) => (
                <div
                  key={template.id}
                  onClick={() => handleTemplateSelect(template)}
                  style={{
                    background: selectedTemplate?.id === template.id ? "#fff0f0" : "#fff",
                    border: selectedTemplate?.id === template.id ? "2px solid #ff6b6b" : "1px solid #e5e7eb",
                    borderRadius: 12,
                    padding: 16,
                    cursor: "pointer",
                    transition: "all 0.2s",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", marginBottom: 8 }}>
                    <h3 style={{ fontSize: 15, fontWeight: 700, color: "#111827", margin: 0 }}>
                      {template.title}
                    </h3>
                    <span style={{ padding: "4px 8px", background: "#f3f4f6", borderRadius: 6, fontSize: 11, fontWeight: 600, color: "#6b7280", textTransform: "capitalize" }}>
                      {template.category}
                    </span>
                  </div>
                  <p style={{ fontSize: 13, color: "#6b7280", margin: 0, lineHeight: 1.5 }}>
                    {template.template.substring(0, 80)}...
                  </p>
                  <div style={{ marginTop: 8, display: "flex", gap: 6, flexWrap: "wrap" }}>
                    {template.variables.map((varName) => (
                      <span key={varName} style={{ padding: "2px 8px", background: "#fff", border: "1px solid #e5e7eb", borderRadius: 4, fontSize: 11, color: "#ff6b6b", fontWeight: 600 }}>
                        {varName}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 16, padding: 24 }}>
            {selectedTemplate ? (
              <>
                <div style={{ marginBottom: 24, paddingBottom: 24, borderBottom: "1px solid #e5e7eb" }}>
                  <h2 style={{ fontSize: 20, fontWeight: 700, color: "#111827", marginBottom: 8 }}>
                    {selectedTemplate.title}
                  </h2>
                  <p style={{ fontSize: 14, color: "#6b7280", marginBottom: 16 }}>
                    Personaliza los valores de las variables para generar tu prompt
                  </p>
                  <div style={{ background: "#f9fafb", border: "1px solid #e5e7eb", borderRadius: 8, padding: 16, fontSize: 13, color: "#374151", lineHeight: 1.6, fontFamily: "monospace" }}>
                    {selectedTemplate.template}
                  </div>
                </div>

                <div style={{ marginBottom: 24 }}>
                  <h3 style={{ fontSize: 16, fontWeight: 700, color: "#111827", marginBottom: 16 }}>
                    Variables
                  </h3>
                  <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                    {selectedTemplate.variables.map((varName) => {
                      const varDef = variables.find((v) => v.variable_name === varName);
                      if (!varDef) return null;

                      return (
                        <div key={varName}>
                          <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#374151", marginBottom: 6 }}>
                            {varDef.display_name}
                            {varDef.description && (
                              <span style={{ fontWeight: 400, color: "#9ca3af", marginLeft: 8 }}>
                                ({varDef.description})
                              </span>
                            )}
                          </label>
                          {varDef.variable_type === "select" ? (
                            <select
                              value={variableValues[varName] || ""}
                              onChange={(e) => setVariableValues((prev) => ({ ...prev, [varName]: e.target.value }))}
                              style={{ width: "100%", padding: "10px 14px", border: "1px solid #e5e7eb", borderRadius: 8, fontSize: 14, outline: "none", cursor: "pointer" }}
                            >
                              {varDef.possible_values?.map((value) => (
                                <option key={value} value={value}>
                                  {value}
                                </option>
                              ))}
                            </select>
                          ) : (
                            <input
                              type="text"
                              value={variableValues[varName] || ""}
                              onChange={(e) => setVariableValues((prev) => ({ ...prev, [varName]: e.target.value }))}
                              style={{ width: "100%", padding: "10px 14px", border: "1px solid #e5e7eb", borderRadius: 8, fontSize: 14, outline: "none" }}
                            />
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                <button
                  onClick={generatePrompt}
                  disabled={generating}
                  style={{ width: "100%", padding: "12px 20px", background: generating ? "#e5e7eb" : "#ff6b6b", color: "#fff", border: "none", borderRadius: 10, fontWeight: 700, fontSize: 15, cursor: generating ? "not-allowed" : "pointer", marginBottom: 24 }}
                >
                  {generating ? "Generando..." : "🎨 Generar Prompt"}
                </button>

                {generatedPrompt && (
                  <div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                      <h3 style={{ fontSize: 16, fontWeight: 700, color: "#111827", margin: 0 }}>
                        Prompt Generado
                      </h3>
                      <button onClick={copyToClipboard} style={{ padding: "8px 16px", background: "#10b981", color: "#fff", border: "none", borderRadius: 8, fontWeight: 600, fontSize: 13, cursor: "pointer" }}>
                        📋 Copiar
                      </button>
                    </div>
                    <div style={{ background: "#f9fafb", border: "2px solid #10b981", borderRadius: 8, padding: 16, fontSize: 14, color: "#111827", lineHeight: 1.6 }}>
                      {generatedPrompt}
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div style={{ textAlign: "center", padding: "80px 20px", color: "#9ca3af" }}>
                <div style={{ fontSize: 64, marginBottom: 16 }}>✨</div>
                <h3 style={{ fontSize: 18, fontWeight: 600, color: "#6b7280", marginBottom: 8 }}>
                  Selecciona una plantilla
                </h3>
                <p style={{ fontSize: 14 }}>
                  Elige una plantilla de la izquierda para comenzar a personalizar tu prompt
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}