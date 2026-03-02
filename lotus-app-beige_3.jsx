import { useState, useEffect } from "react";

// ─── Design Tokens — Warm Beige Earth ──────────────────────────────────────
const T = {
    bg: "#F5EFE6",
    surface: "#EDE4D8",
    surface2: "#E8DDD0",
    surface3: "#DDD0C0",
    border: "#C8B89A",
    borderLight: "#DDD0C0",
    text: "#3D2E1E",
    textMid: "#7A5C3E",
    textMuted: "#A68B6A",
    textDim: "#C4A882",

    // Accent palette
    rose: "#C4725A",   // terracotta rose
    roseBg: "#F5E8E3",
    sage: "#6B8F71",   // sage green
    sageBg: "#E8F0E8",
    amber: "#B8860B",   // dark amber / gold
    amberBg: "#F5EDD8",
    plum: "#8B5E7A",   // dusty plum
    plumBg: "#EEE3EC",
    cream: "#FAF6F0",
};

const PHASES = {
    menstrual: { label: "الحيض", emoji: "🌸", color: T.rose, glow: "rgba(196,114,90,0.18)", bg: T.roseBg, tip: "استريحي، كمادات دافئة وشاي الزنجبيل الآن." },
    follicular: { label: "الجريبية", emoji: "🌱", color: T.sage, glow: "rgba(107,143,113,0.18)", bg: T.sageBg, tip: "طاقتك ترتفع — وقت مثالي لتمارين جديدة والبروتين." },
    ovulation: { label: "التبويض", emoji: "✨", color: T.amber, glow: "rgba(184,134,11,0.18)", bg: T.amberBg, tip: "ذروة الطاقة والتركيز — تحدّي أهدافك الكبيرة الآن!" },
    luteal: { label: "الجسم الأصفر", emoji: "🍂", color: T.plum, glow: "rgba(139,94,122,0.18)", bg: T.plumBg, tip: "لاحظي تقلبات المزاج، قلّلي الكافيين وتأمّلي." },
};

const SYMPTOMS = ["تشنجات", "صداع", "انتفاخ", "تعب", "حساسية الثدي", "مزاج متقلب", "رغبة شديدة بالأكل", "دوخة"];
const MOODS = ["😊", "😢", "😠", "😴", "🤩", "😟", "😌", "🥰"];
const OVU_TESTS = ["سلبي ➖", "خط خافت 🟡", "خط قوي 🟠", "إيجابي ✅"];

function calcPhase(lastPeriod, cycleLen, periodLen) {
    if (!lastPeriod) return { phase: "follicular", cycleDay: 1, daysLeft: 0, daysToNext: cycleLen, ovulationDay: cycleLen - 14 };
    const now = new Date();
    const start = new Date(lastPeriod);
    const diff = Math.floor((now - start) / 86400000) + 1;
    const cycleDay = ((diff - 1) % cycleLen) + 1;
    const ovulationDay = cycleLen - 14;
    const nextPeriod = new Date(start.getTime() + Math.ceil(diff / cycleLen) * cycleLen * 86400000);
    const daysToNext = Math.max(0, Math.ceil((nextPeriod - now) / 86400000));
    let phase, daysLeft;
    if (cycleDay <= periodLen) { phase = "menstrual"; daysLeft = periodLen - cycleDay; }
    else if (cycleDay <= ovulationDay - 1) { phase = "follicular"; daysLeft = ovulationDay - 1 - cycleDay; }
    else if (cycleDay <= ovulationDay + 1) { phase = "ovulation"; daysLeft = ovulationDay + 1 - cycleDay; }
    else { phase = "luteal"; daysLeft = cycleLen - cycleDay; }
    return { phase, cycleDay, daysLeft, daysToNext, ovulationDay };
}

function timeGreeting() {
    const h = new Date().getHours();
    if (h < 12) return "صباح النور ☀️";
    if (h < 17) return "مساء الجمال 🌤";
    return "ليلة هنية 🌙";
}

// ─── Shared UI ──────────────────────────────────────────────────────────────
const Card = ({ children, style = {} }) => (
    <div style={{
        background: T.cream,
        borderRadius: 22,
        padding: "16px 18px",
        marginBottom: 12,
        border: `1px solid ${T.borderLight}`,
        boxShadow: "0 2px 12px rgba(100,70,40,0.07)",
        ...style
    }}>{children}</div>
);

const SLabel = ({ children, color }) => (
    <p style={{ fontSize: 10, fontWeight: 800, color: color || T.textMuted, letterSpacing: 1.8, textTransform: "uppercase", marginBottom: 10 }}>{children}</p>
);

const Row = ({ children, style = {} }) => (
    <div style={{ display: "flex", alignItems: "center", gap: 10, ...style }}>{children}</div>
);

const Pill = ({ children, color, bg }) => (
    <span style={{ background: bg || T.surface2, color: color || T.textMid, borderRadius: 20, padding: "3px 12px", fontSize: 11, fontWeight: 700 }}>{children}</span>
);

// ─── Ovulation Strip Reader (AI-powered) ────────────────────────────────────
function OvulationStripReader({ onSaveResult }) {
    const [image, setImage] = useState(null);   // base64 data URL
    const [preview, setPreview] = useState(null);
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState(null);   // AI analysis result
    const [error, setError] = useState(null);
    const [saved, setSaved] = useState(false);
    const fileRef = useState(null);

    const STRENGTH_LEVELS = [
        { label: "سلبي", emoji: "⚪", color: "#B0B0B0", bar: 0, desc: "لا يوجد LH مرتفع، التبويض لم يقترب بعد." },
        { label: "خافت جداً", emoji: "🟡", color: "#D4B800", bar: 20, desc: "مستوى LH منخفض، الجسم قد يبدأ بالتحضير." },
        { label: "خط خافت", emoji: "🟠", color: "#E08C30", bar: 40, desc: "LH يرتفع تدريجياً، التبويض قد يكون خلال 48-72 ساعة." },
        { label: "خط قوي", emoji: "🔶", color: "#D4601A", bar: 65, desc: "ارتفاع ملحوظ في LH، التبويض قريب خلال 24-48 ساعة." },
        { label: "إيجابي قوي", emoji: "🔴", color: "#C0392B", bar: 85, desc: "ذروة LH! التبويض متوقع خلال 12-36 ساعة — الوقت المثالي." },
        { label: "إيجابي مكثف", emoji: "❤️", color: "#8B0000", bar: 100, desc: "ذروة قصوى للـ LH. التبويض وشيك جداً. أفضل وقت للحمل." },
    ];

    const handleFile = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        setResult(null); setError(null); setSaved(false);
        const reader = new FileReader();
        reader.onload = ev => {
            setPreview(ev.target.result);
            // Extract base64 without prefix
            setImage(ev.target.result.split(",")[1]);
        };
        reader.readAsDataURL(file);
    };

    const analyzeStrip = async () => {
        if (!image) return;
        setLoading(true); setError(null); setResult(null);
        try {
            const resp = await fetch("https://api.anthropic.com/v1/messages", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    model: "claude-sonnet-4-20250514",
                    max_tokens: 1000,
                    messages: [{
                        role: "user",
                        content: [
                            {
                                type: "image",
                                source: { type: "base64", media_type: "image/jpeg", data: image }
                            },
                            {
                                type: "text",
                                text: `أنتِ خبيرة في تحليل اختبارات التبويض المنزلية (OPK). حللي هذه الصورة لشريط اختبار التبويض وأعطيني النتيجة بتنسيق JSON فقط بدون أي نص إضافي أو backticks.

الحقول المطلوبة:
{
  "strengthIndex": رقم من 0 إلى 5 (0=سلبي, 1=خافت جداً, 2=خط خافت, 3=خط قوي, 4=إيجابي قوي, 5=إيجابي مكثف),
  "testLineColor": وصف لون خط الاختبار بالعربية,
  "controlLineColor": وصف لون خط التحكم بالعربية,
  "comparison": مقارنة بين خطي الاختبار والتحكم بالعربية,
  "advice": نصيحة عملية للمستخدمة بالعربية (جملة واحدة أو اثنتان),
  "isValid": true إذا كان الاختبار صالحاً (خط التحكم ظاهر), false إذا لا,
  "confidence": نسبة مئوية من 0-100 لدرجة وضوح الصورة وثقتك بالتحليل
}

إذا الصورة ليست شريط اختبار تبويض، أعيدي: {"error": "ليست صورة شريط اختبار تبويض"}`
                            }
                        ]
                    }]
                })
            });
            const data = await resp.json();
            const text = data.content?.map(c => c.text || "").join("") || "";
            const clean = text.replace(/```json|```/g, "").trim();
            const parsed = JSON.parse(clean);
            if (parsed.error) { setError(parsed.error); }
            else { setResult(parsed); }
        } catch (e) {
            setError("حدث خطأ أثناء التحليل. تأكدي من وضوح الصورة وحاولي مجدداً.");
        }
        setLoading(false);
    };

    const strength = result ? STRENGTH_LEVELS[Math.min(result.strengthIndex, 5)] : null;

    const handleSave = () => {
        if (!result || !strength) return;
        onSaveResult({ date: new Date().toISOString().split("T")[0], result: strength.label, emoji: strength.emoji });
        setSaved(true);
    };

    return (
        <Card style={{ border: `1.5px solid ${T.amber}55`, background: `linear-gradient(145deg, ${T.amberBg}, ${T.cream})` }}>
            <SLabel color={T.amber}>🥚 قراءة شريط التبويض بالذكاء الاصطناعي</SLabel>
            <p style={{ color: T.textMuted, fontSize: 12, marginBottom: 14, lineHeight: 1.7 }}>
                صوّري شريط اختبار التبويض وسيحلله الذكاء الاصطناعي ويخبرك بقوة التبويض فوراً.
            </p>

            {/* Upload area */}
            <label style={{ display: "block", cursor: "pointer" }}>
                <input type="file" accept="image/*" onChange={handleFile} style={{ display: "none" }} />
                <div style={{
                    border: `2px dashed ${preview ? T.amber : T.border}`,
                    borderRadius: 16,
                    padding: preview ? 0 : "24px 16px",
                    textAlign: "center",
                    background: preview ? "transparent" : T.surface2,
                    overflow: "hidden",
                    transition: "all 0.3s",
                    minHeight: preview ? 0 : 100,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexDirection: "column",
                    gap: 8,
                }}>
                    {preview ? (
                        <div style={{ position: "relative" }}>
                            <img src={preview} alt="شريط الاختبار" style={{ width: "100%", maxHeight: 200, objectFit: "contain", borderRadius: 14, display: "block" }} />
                            <div style={{ position: "absolute", bottom: 8, left: 8, background: "rgba(0,0,0,0.55)", color: "#fff", fontSize: 11, borderRadius: 8, padding: "3px 10px" }}>
                                اضغطي للتغيير
                            </div>
                        </div>
                    ) : (
                        <>
                            <span style={{ fontSize: 36 }}>📸</span>
                            <p style={{ color: T.textMid, fontWeight: 700, fontSize: 14 }}>ارفعي صورة الشريط</p>
                            <p style={{ color: T.textDim, fontSize: 11 }}>JPG, PNG — الصورة تبقى خاصة بك</p>
                        </>
                    )}
                </div>
            </label>

            {/* Analyze button */}
            {preview && !result && (
                <button onClick={analyzeStrip} disabled={loading}
                    style={{ width: "100%", padding: "12px 0", marginTop: 12, background: loading ? T.surface2 : T.amber, color: loading ? T.textMuted : "#fff", border: "none", borderRadius: 14, fontWeight: 900, fontSize: 14, cursor: loading ? "not-allowed" : "pointer", transition: "all 0.3s", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
                    {loading ? (
                        <>
                            <span style={{ display: "inline-block", animation: "spin 1s linear infinite", fontSize: 18 }}>⏳</span>
                            جاري التحليل...
                        </>
                    ) : "🔍 تحليل الشريط بالذكاء الاصطناعي"}
                </button>
            )}

            {/* Error */}
            {error && (
                <div style={{ marginTop: 12, padding: "12px 14px", background: "#FFF0F0", border: "1px solid #E8536A55", borderRadius: 12 }}>
                    <p style={{ color: "#C0392B", fontSize: 13, fontWeight: 700 }}>⚠️ {error}</p>
                </div>
            )}

            {/* Result */}
            {result && strength && (
                <div style={{ marginTop: 14 }}>
                    {/* Validity warning */}
                    {!result.isValid && (
                        <div style={{ padding: "8px 14px", background: "#FFF8E1", border: "1px solid #F4A261", borderRadius: 10, marginBottom: 10 }}>
                            <p style={{ color: "#E08C30", fontSize: 12, fontWeight: 700 }}>⚠️ خط التحكم غير واضح — قد يكون الاختبار منتهي الصلاحية</p>
                        </div>
                    )}

                    {/* Strength card */}
                    <div style={{ background: T.cream, border: `2px solid ${strength.color}55`, borderRadius: 18, padding: "16px 16px 14px", textAlign: "center" }}>
                        <p style={{ fontSize: 40 }}>{strength.emoji}</p>
                        <p style={{ color: strength.color, fontSize: 20, fontWeight: 900, marginTop: 6 }}>{strength.label}</p>

                        {/* Bar */}
                        <div style={{ margin: "14px 0 6px", background: T.surface2, borderRadius: 20, height: 12, overflow: "hidden" }}>
                            <div style={{ width: `${strength.bar}%`, height: "100%", background: `linear-gradient(90deg, #D4B800, ${strength.color})`, borderRadius: 20, transition: "width 0.8s ease" }} />
                        </div>
                        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 9, color: T.textDim, marginBottom: 12 }}>
                            <span>سلبي</span><span>خافت</span><span>قوي</span><span>إيجابي</span><span>مكثف</span>
                        </div>

                        <p style={{ color: T.textMid, fontSize: 13, lineHeight: 1.7, marginBottom: 10 }}>{strength.desc}</p>
                    </div>

                    {/* Details */}
                    <div style={{ marginTop: 10, background: T.surface2, borderRadius: 14, padding: "12px 14px", border: `1px solid ${T.borderLight}` }}>
                        <p style={{ color: T.textDim, fontSize: 10, fontWeight: 800, letterSpacing: 1, marginBottom: 8 }}>تفاصيل التحليل</p>
                        {[
                            { label: "خط الاختبار", val: result.testLineColor },
                            { label: "خط التحكم", val: result.controlLineColor },
                            { label: "المقارنة", val: result.comparison },
                        ].map(d => (
                            <div key={d.label} style={{ display: "flex", justifyContent: "space-between", marginBottom: 6, gap: 8 }}>
                                <span style={{ color: T.textDim, fontSize: 11, flexShrink: 0 }}>{d.label}</span>
                                <span style={{ color: T.textMid, fontSize: 11, fontWeight: 700, textAlign: "left" }}>{d.val}</span>
                            </div>
                        ))}
                        <div style={{ marginTop: 8, paddingTop: 8, borderTop: `1px solid ${T.borderLight}` }}>
                            <p style={{ color: T.amber, fontSize: 12, fontWeight: 700 }}>💡 {result.advice}</p>
                        </div>
                        <p style={{ color: T.textDim, fontSize: 10, marginTop: 6 }}>دقة التحليل: {result.confidence}%</p>
                    </div>

                    {/* Save + retry */}
                    <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                        <button onClick={handleSave} disabled={saved}
                            style={{ flex: 1, padding: "11px 0", background: saved ? T.sageBg : T.sage, color: saved ? T.sage : "#fff", border: `1.5px solid ${T.sage}`, borderRadius: 14, fontWeight: 900, fontSize: 13, cursor: saved ? "default" : "pointer" }}>
                            {saved ? "✅ تم الحفظ" : "💾 حفظ في السجل"}
                        </button>
                        <button onClick={() => { setResult(null); setPreview(null); setImage(null); setSaved(false); }}
                            style={{ flex: 1, padding: "11px 0", background: T.surface2, color: T.textMid, border: `1px solid ${T.borderLight}`, borderRadius: 14, fontWeight: 700, fontSize: 13, cursor: "pointer" }}>
                            🔄 اختبار جديد
                        </button>
                    </div>
                </div>
            )}

            <style>{`@keyframes spin { from {transform:rotate(0deg)} to {transform:rotate(360deg)} }`}</style>
        </Card>
    );
}

// ─── Tab: دورتي ─────────────────────────────────────────────────────────────
function CycleTab({ cycleData, cycleInput, setCycleInput, symptoms, toggleSymptom, onSaveOvuTest }) {
    const { phase, cycleDay, daysLeft, ovulationDay, daysToNext } = cycleData;
    const p = PHASES[phase];
    const phases = ["menstrual", "follicular", "ovulation", "luteal"];
    const pct = Math.round((cycleDay / cycleInput.cycleLen) * 100);

    return (
        <div>
            {/* Hero phase card */}
            <Card style={{ background: `linear-gradient(145deg, ${p.bg}, ${T.cream})`, border: `1.5px solid ${p.color}55`, paddingTop: 22, paddingBottom: 22 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                    <div style={{ width: 64, height: 64, borderRadius: 20, background: p.color + "18", border: `1.5px solid ${p.color}44`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 32, flexShrink: 0 }}>
                        {p.emoji}
                    </div>
                    <div style={{ flex: 1 }}>
                        <p style={{ color: T.textMuted, fontSize: 11, letterSpacing: 1 }}>مرحلتك الحالية</p>
                        <p style={{ color: p.color, fontSize: 20, fontWeight: 900, marginTop: 2 }}>{p.label}</p>
                        <p style={{ color: T.textMuted, fontSize: 11, marginTop: 4, lineHeight: 1.6 }}>{p.tip}</p>
                    </div>
                </div>

                <div style={{ display: "flex", gap: 0, marginTop: 18, background: T.surface2, borderRadius: 16, overflow: "hidden", border: `1px solid ${T.borderLight}` }}>
                    {[
                        { val: cycleDay, label: "يوم الدورة" },
                        { val: daysLeft, label: "أيام متبقية" },
                        { val: daysToNext, label: "للدورة القادمة" },
                    ].map((s, i) => (
                        <div key={i} style={{ flex: 1, textAlign: "center", padding: "12px 6px", borderLeft: i > 0 ? `1px solid ${T.borderLight}` : undefined }}>
                            <p style={{ color: p.color, fontSize: 22, fontWeight: 900 }}>{s.val}</p>
                            <p style={{ color: T.textDim, fontSize: 9, marginTop: 2 }}>{s.label}</p>
                        </div>
                    ))}
                </div>
            </Card>

            {/* Progress */}
            <Card>
                <SLabel>تقدم دورتك</SLabel>
                <div style={{ background: T.surface2, borderRadius: 20, height: 10, overflow: "hidden", marginBottom: 6 }}>
                    <div style={{ width: `${pct}%`, height: "100%", background: `linear-gradient(90deg, ${p.color}cc, ${p.color}66)`, borderRadius: 20, transition: "width 0.6s" }} />
                </div>
                <Row style={{ justifyContent: "space-between" }}>
                    {phases.map(ph => {
                        const pp = PHASES[ph]; const active = ph === phase;
                        return (
                            <div key={ph} style={{ textAlign: "center", flex: 1 }}>
                                <span style={{ fontSize: 16, filter: active ? "none" : "grayscale(1) opacity(0.35)" }}>{pp.emoji}</span>
                                <p style={{ fontSize: 8, color: active ? pp.color : T.textDim, fontWeight: active ? 900 : 400, marginTop: 2, lineHeight: 1.2 }}>{pp.label}</p>
                            </div>
                        );
                    })}
                </Row>
            </Card>

            {/* Inputs */}
            <Card>
                <SLabel>ضبط دورتك</SLabel>
                <p style={{ fontSize: 11, color: T.textMuted, marginBottom: 6 }}>تاريخ آخر دورة</p>
                <input type="date" value={cycleInput.lastPeriod}
                    onChange={e => setCycleInput(p => ({ ...p, lastPeriod: e.target.value }))}
                    style={{ width: "100%", padding: "10px 12px", borderRadius: 12, border: `1.5px solid ${T.border}`, background: T.surface2, color: T.text, fontSize: 14, marginBottom: 14, boxSizing: "border-box", direction: "ltr", outline: "none" }} />

                <p style={{ fontSize: 11, color: T.textMuted, marginBottom: 4 }}>طول الدورة — <span style={{ color: T.amber, fontWeight: 800 }}>{cycleInput.cycleLen} يوم</span></p>
                <input type="range" min={21} max={45} value={cycleInput.cycleLen}
                    onChange={e => setCycleInput(p => ({ ...p, cycleLen: +e.target.value }))}
                    style={{ width: "100%", marginBottom: 14, accentColor: T.amber }} />

                <p style={{ fontSize: 11, color: T.textMuted, marginBottom: 4 }}>مدة الحيض — <span style={{ color: T.rose, fontWeight: 800 }}>{cycleInput.periodLen} أيام</span></p>
                <input type="range" min={2} max={10} value={cycleInput.periodLen}
                    onChange={e => setCycleInput(p => ({ ...p, periodLen: +e.target.value }))}
                    style={{ width: "100%", accentColor: T.rose }} />

                {ovulationDay && (
                    <div style={{ marginTop: 14, background: PHASES.ovulation.bg, borderRadius: 12, padding: "10px 14px", border: `1px solid ${PHASES.ovulation.color}44` }}>
                        <p style={{ color: PHASES.ovulation.color, fontSize: 13, fontWeight: 700 }}>✨ التبويض المتوقع: اليوم {ovulationDay}</p>
                    </div>
                )}
            </Card>

            {/* Timeline */}
            <Card>
                <SLabel>مراحل دورتك</SLabel>
                {phases.map(ph => {
                    const pp = PHASES[ph]; const active = ph === phase;
                    return (
                        <div key={ph} style={{ display: "flex", gap: 12, alignItems: "flex-start", marginBottom: 14, opacity: active ? 1 : 0.55, transition: "opacity 0.3s" }}>
                            <div style={{ width: 42, height: 42, borderRadius: 14, background: active ? pp.color : T.surface2, border: `1.5px solid ${active ? pp.color : T.borderLight}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, flexShrink: 0, transition: "all 0.3s" }}>
                                {pp.emoji}
                            </div>
                            <div>
                                <p style={{ color: active ? pp.color : T.textMid, fontWeight: 800, fontSize: 13, marginBottom: 2 }}>{pp.label}</p>
                                <p style={{ color: T.textMuted, fontSize: 11, lineHeight: 1.6 }}>{pp.tip}</p>
                            </div>
                        </div>
                    );
                })}
            </Card>

            {/* AI Strip Reader */}
            <OvulationStripReader onSaveResult={onSaveOvuTest} />

            {/* Symptoms */}
            <Card>
                <SLabel>أعراض اليوم</SLabel>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                    {SYMPTOMS.map(s => {
                        const on = symptoms.includes(s);
                        return (
                            <button key={s} onClick={() => toggleSymptom(s)} style={{ padding: "7px 14px", borderRadius: 20, fontSize: 12, fontWeight: 700, background: on ? T.rose : T.surface2, color: on ? "#fff" : T.textMuted, border: `1px solid ${on ? T.rose : T.borderLight}`, cursor: "pointer", transition: "all 0.2s" }}>{s}</button>
                        );
                    })}
                </div>
            </Card>
        </div>
    );
}

// ─── Tab: الرئيسية ──────────────────────────────────────────────────────────
function HomeTab({ cycleData, tracking, cycleInput }) {
    const { phase, daysToNext, cycleDay, ovulationDay } = cycleData;
    const p = PHASES[phase];

    const stats = [
        { icon: "💧", label: "ماء", val: `${tracking.water}/8`, unit: "أكواب", color: T.sage },
        { icon: "😴", label: "نوم", val: tracking.sleep, unit: "ساعة", color: T.plum },
        { icon: "🔥", label: "سعرات", val: tracking.totalCal, unit: "ك.سع", color: T.rose },
        { icon: "⚖️", label: "وزن", val: tracking.weight || "—", unit: "كغ", color: T.amber },
    ];

    return (
        <div>
            {/* Greeting banner */}
            <Card style={{ background: `linear-gradient(145deg, ${p.bg}, ${T.cream})`, border: `1.5px solid ${p.color}44`, paddingTop: 20, paddingBottom: 20 }}>
                <p style={{ color: T.textMuted, fontSize: 12 }}>{timeGreeting()}</p>
                <Row style={{ marginTop: 6, marginBottom: 8 }}>
                    <span style={{ fontSize: 28 }}>{p.emoji}</span>
                    <div>
                        <p style={{ color: T.text, fontSize: 17, fontWeight: 900 }}>أنتِ في مرحلة <span style={{ color: p.color }}>{p.label}</span></p>
                        <p style={{ color: T.textMuted, fontSize: 11, marginTop: 2 }}>{p.tip}</p>
                    </div>
                </Row>
                <div style={{ background: T.surface2, borderRadius: 14, padding: "10px 16px", border: `1px solid ${T.borderLight}` }}>
                    <Row style={{ justifyContent: "space-between" }}>
                        <div>
                            <p style={{ color: T.textDim, fontSize: 10 }}>الدورة القادمة خلال</p>
                            <p style={{ color: p.color, fontSize: 26, fontWeight: 900, lineHeight: 1 }}>{daysToNext} <span style={{ fontSize: 13, fontWeight: 500 }}>يوم</span></p>
                        </div>
                        <div style={{ textAlign: "left" }}>
                            <p style={{ color: T.textDim, fontSize: 10 }}>اليوم الحالي</p>
                            <p style={{ color: T.textMid, fontSize: 20, fontWeight: 800, lineHeight: 1 }}>{cycleDay}</p>
                        </div>
                    </Row>
                </div>
            </Card>

            {/* Stats */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 12 }}>
                {stats.map(s => (
                    <div key={s.label} style={{ background: T.cream, border: `1px solid ${T.borderLight}`, borderRadius: 18, padding: "14px 16px", boxShadow: "0 2px 10px rgba(100,70,40,0.06)" }}>
                        <p style={{ fontSize: 22 }}>{s.icon}</p>
                        <p style={{ color: T.textDim, fontSize: 10, marginTop: 4 }}>{s.label}</p>
                        <Row style={{ alignItems: "baseline", gap: 4, marginTop: 2 }}>
                            <span style={{ color: s.color, fontSize: 20, fontWeight: 900 }}>{s.val}</span>
                            <span style={{ color: T.textDim, fontSize: 10 }}>{s.unit}</span>
                        </Row>
                    </div>
                ))}
            </div>

            {/* Ring */}
            <Card>
                <SLabel>تقدم دورتك</SLabel>
                <Row style={{ gap: 20 }}>
                    <svg width={86} height={86} viewBox="0 0 86 86" style={{ flexShrink: 0 }}>
                        <circle cx={43} cy={43} r={34} fill="none" stroke={T.surface2} strokeWidth={7} />
                        <circle cx={43} cy={43} r={34} fill="none" stroke={p.color} strokeWidth={7}
                            strokeDasharray={`${(cycleDay / cycleInput.cycleLen) * 214} 214`}
                            strokeLinecap="round" transform="rotate(-90 43 43)" />
                        <text x={43} y={46} textAnchor="middle" fill={p.color} fontSize={17} fontWeight={900}>{cycleDay}</text>
                        <text x={43} y={57} textAnchor="middle" fill={T.textDim} fontSize={8}>يوم</text>
                    </svg>
                    <div style={{ flex: 1 }}>
                        {[
                            { label: "المرحلة الحالية", val: p.label, color: p.color },
                            { label: "التبويض المتوقع", val: `يوم ${ovulationDay || "—"}`, color: PHASES.ovulation.color },
                            { label: "المزاج", val: tracking.mood || "لم يُسجَّل", color: T.plum },
                        ].map(r => (
                            <div key={r.label} style={{ marginBottom: 9 }}>
                                <p style={{ color: T.textDim, fontSize: 9, letterSpacing: 0.5 }}>{r.label}</p>
                                <p style={{ color: r.color, fontWeight: 800, fontSize: 13 }}>{r.val}</p>
                            </div>
                        ))}
                    </div>
                </Row>
            </Card>
        </div>
    );
}

// ─── Tab: تتبع ──────────────────────────────────────────────────────────────
function TrackingTab({ tracking, setTracking }) {
    const [meal, setMeal] = useState(""), [cal, setCal] = useState("");

    const addMeal = () => {
        if (!meal || !cal) return;
        setTracking(p => ({ ...p, meals: [...p.meals, { name: meal, cal: +cal }], totalCal: p.totalCal + (+cal) }));
        setMeal(""); setCal("");
    };

    const sleepMsg = tracking.sleep < 6 ? "😔 نومك قصير — حاولي الراحة أكثر"
        : tracking.sleep <= 9 ? "✅ نوم صحي ومثالي"
            : "💤 كثرة النوم قد تسبب خمولاً";

    const inp = { padding: "10px 12px", borderRadius: 12, border: `1.5px solid ${T.border}`, background: T.surface2, color: T.text, fontSize: 14, outline: "none", boxSizing: "border-box" };

    return (
        <div>
            {/* Water */}
            <Card>
                <SLabel color={T.sage}>💧 شرب الماء</SLabel>
                <div style={{ display: "flex", gap: 5, flexWrap: "wrap", marginBottom: 12 }}>
                    {[...Array(8)].map((_, i) => (
                        <button key={i} onClick={() => setTracking(p => ({ ...p, water: i < p.water ? i : i + 1 }))}
                            style={{ fontSize: 26, background: "none", border: "none", cursor: "pointer", filter: i < tracking.water ? "none" : "grayscale(1) opacity(0.3)", transform: i < tracking.water ? "scale(1.08)" : "scale(1)", transition: "all 0.2s" }}>
                            🥤
                        </button>
                    ))}
                </div>
                <div style={{ background: T.surface2, borderRadius: 20, height: 8, overflow: "hidden" }}>
                    <div style={{ width: `${(tracking.water / 8) * 100}%`, height: "100%", background: `linear-gradient(90deg, ${T.sage}, ${T.sage}88)`, borderRadius: 20, transition: "width 0.4s" }} />
                </div>
                <p style={{ color: T.sage, fontSize: 12, fontWeight: 700, marginTop: 6 }}>{tracking.water} / 8 أكواب</p>
            </Card>

            {/* Sleep */}
            <Card>
                <SLabel color={T.plum}>😴 النوم</SLabel>
                <input type="range" min={1} max={12} value={tracking.sleep}
                    onChange={e => setTracking(p => ({ ...p, sleep: +e.target.value }))}
                    style={{ width: "100%", accentColor: T.plum, marginBottom: 8 }} />
                <Row style={{ justifyContent: "space-between" }}>
                    <span style={{ color: T.plum, fontWeight: 900, fontSize: 18 }}>{tracking.sleep} ساعة</span>
                    <p style={{ color: T.textMuted, fontSize: 12 }}>{sleepMsg}</p>
                </Row>
            </Card>

            {/* Mood */}
            <Card>
                <SLabel color={T.amber}>🌈 المزاج</SLabel>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    {MOODS.map(m => (
                        <button key={m} onClick={() => setTracking(p => ({ ...p, mood: m }))}
                            style={{ fontSize: 28, background: tracking.mood === m ? T.amberBg : "none", border: `2px solid ${tracking.mood === m ? T.amber : "transparent"}`, borderRadius: 14, padding: 4, cursor: "pointer", transition: "all 0.2s", transform: tracking.mood === m ? "scale(1.15)" : "scale(1)" }}>
                            {m}
                        </button>
                    ))}
                </div>
            </Card>

            {/* Weight */}
            <Card>
                <SLabel color={T.amber}>⚖️ الوزن اليومي</SLabel>
                <Row>
                    <input type="number" placeholder="الوزن بالكيلوغرام" value={tracking.weight || ""}
                        onChange={e => setTracking(p => ({ ...p, weight: e.target.value }))}
                        style={{ ...inp, flex: 1, width: "100%" }} />
                    {tracking.weight && <span style={{ color: T.amber, fontWeight: 900, fontSize: 16, whiteSpace: "nowrap" }}>{tracking.weight} كغ</span>}
                </Row>
            </Card>

            {/* Meals */}
            <Card>
                <SLabel color={T.rose}>🍽 سجل الوجبات</SLabel>
                <Row style={{ marginBottom: 10 }}>
                    <input value={meal} onChange={e => setMeal(e.target.value)} placeholder="اسم الوجبة" style={{ ...inp, flex: 1 }} />
                    <input value={cal} onChange={e => setCal(e.target.value)} type="number" placeholder="سعرات" style={{ ...inp, width: 80 }} />
                    <button onClick={addMeal} style={{ background: T.rose, color: "#fff", border: "none", borderRadius: 12, width: 40, height: 40, fontWeight: 900, cursor: "pointer", fontSize: 20, flexShrink: 0 }}>+</button>
                </Row>
                {tracking.meals.map((m, i) => (
                    <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: `1px solid ${T.borderLight}`, fontSize: 13 }}>
                        <span style={{ color: T.textMid }}>{m.name}</span>
                        <span style={{ color: T.rose, fontWeight: 800 }}>{m.cal} ك.سع</span>
                    </div>
                ))}
                {tracking.meals.length > 0 && (
                    <Row style={{ justifyContent: "space-between", marginTop: 10, padding: "8px 12px", background: T.roseBg, borderRadius: 12, border: `1px solid ${T.rose}33` }}>
                        <span style={{ color: T.textMuted, fontSize: 13 }}>إجمالي السعرات</span>
                        <span style={{ color: T.rose, fontWeight: 900, fontSize: 16 }}>{tracking.totalCal}</span>
                    </Row>
                )}
            </Card>
        </div>
    );
}

// ─── Tab: نصائح ─────────────────────────────────────────────────────────────
function TipsTab({ phase }) {
    const p = PHASES[phase];
    const general = [
        { icon: "💧", title: "الترطيب", body: "اشربي 8 أكواب ماء يومياً. يساعد على تقليل الانتفاخ وتحسين الطاقة." },
        { icon: "🧘", title: "التأمل", body: "10 دقائق تأمل صباحي تخفض الكورتيزول وتحسّن التركيز." },
        { icon: "🥗", title: "التغذية", body: "أطعمة غنية بالحديد والمغنيسيوم تدعم توازن الهرمونات." },
        { icon: "🚶", title: "المشي", body: "30 دقيقة مشي يومياً تخفف التقلصات وتحسّن المزاج." },
        { icon: "🌙", title: "النوم", body: "7-9 ساعات نوم تنظّم الهرمونات وتقوّي المناعة." },
        { icon: "☕", title: "الكافيين", body: "قللي القهوة قبل الدورة؛ استبدليها بشاي الزنجبيل أو البابونج." },
    ];
    return (
        <div>
            <Card style={{ background: `linear-gradient(145deg, ${p.bg}, ${T.cream})`, border: `1.5px solid ${p.color}55`, textAlign: "center", paddingTop: 22, paddingBottom: 22 }}>
                <p style={{ fontSize: 38 }}>{p.emoji}</p>
                <p style={{ color: p.color, fontWeight: 900, fontSize: 16, marginTop: 8, marginBottom: 8 }}>نصيحة مرحلة {p.label}</p>
                <p style={{ color: T.textMuted, fontSize: 13, lineHeight: 1.8 }}>{p.tip}</p>
            </Card>

            <p style={{ color: T.textDim, fontSize: 10, fontWeight: 800, letterSpacing: 1.8, marginBottom: 10 }}>نصائح صحية عامة</p>
            {general.map(t => (
                <Card key={t.title} style={{ padding: "14px 16px" }}>
                    <Row>
                        <div style={{ width: 42, height: 42, background: T.surface2, borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, flexShrink: 0, border: `1px solid ${T.borderLight}` }}>{t.icon}</div>
                        <div>
                            <p style={{ color: T.amber, fontWeight: 800, fontSize: 13, marginBottom: 3 }}>{t.title}</p>
                            <p style={{ color: T.textMuted, fontSize: 12, lineHeight: 1.6 }}>{t.body}</p>
                        </div>
                    </Row>
                </Card>
            ))}

            <Card style={{ border: `1.5px solid ${T.rose}44`, background: T.roseBg }}>
                <SLabel color={T.rose}>🌸 نصائح أثناء الدورة</SLabel>
                {["استخدمي وسادة تدفئة على البطن", "تجنبي الأطعمة المالحة والمصنّعة", "تناولي الشوكولاتة الداكنة للمغنيسيوم", "مارسي اليوغا الخفيفة لتخفيف التقلصات", "احرصي على الراحة ولا تضغطي على نفسك"].map(t => (
                    <Row key={t} style={{ gap: 8, marginBottom: 8, alignItems: "flex-start" }}>
                        <div style={{ width: 6, height: 6, borderRadius: "50%", background: T.rose, marginTop: 5, flexShrink: 0 }} />
                        <p style={{ color: T.textMid, fontSize: 12, lineHeight: 1.7 }}>{t}</p>
                    </Row>
                ))}
            </Card>
        </div>
    );
}

// ─── Tab: إعدادات ───────────────────────────────────────────────────────────
function SettingsTab({ profile, setProfile, cycleHistory, ovulationTests, setOvulationTests }) {
    const [testResult, setTestResult] = useState(OVU_TESTS[0]);
    const [testDate, setTestDate] = useState("");
    const [notif, setNotif] = useState({ prePeriod: true, delay: true, ovulation: true });
    const [profileImg, setProfileImg] = useState(null);

    const handleProfileImg = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = ev => setProfileImg(ev.target.result);
        reader.readAsDataURL(file);
    };

    const addTest = () => {
        if (!testDate) return;
        setOvulationTests(p => [...p, { date: testDate, result: testResult }]);
        setTestDate("");
    };

    const bmi = profile.weight && profile.height ? (profile.weight / ((profile.height / 100) ** 2)).toFixed(1) : null;

    const inp = { width: "100%", padding: "10px 12px", borderRadius: 12, border: `1.5px solid ${T.border}`, background: T.surface2, color: T.text, fontSize: 14, marginTop: 4, marginBottom: 12, boxSizing: "border-box", outline: "none" };

    const Toggle = ({ on, onToggle, color }) => (
        <button onClick={onToggle} style={{ width: 46, height: 26, borderRadius: 13, background: on ? (color || T.sage) : T.surface2, border: `1px solid ${on ? (color || T.sage) : T.borderLight}`, cursor: "pointer", position: "relative", transition: "all 0.3s", flexShrink: 0 }}>
            <span style={{ position: "absolute", top: 3, left: on ? 22 : 3, width: 18, height: 18, borderRadius: "50%", background: "#fff", transition: "left 0.3s", boxShadow: "0 1px 4px rgba(0,0,0,0.15)" }} />
        </button>
    );

    return (
        <div>
            {/* Profile */}
            <Card>
                <SLabel>👤 الملف الشخصي</SLabel>

                {/* Profile Avatar */}
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginBottom: 18 }}>
                    <label style={{ cursor: "pointer", position: "relative" }}>
                        <input type="file" accept="image/*" onChange={handleProfileImg} style={{ display: "none" }} />
                        <div style={{
                            width: 90, height: 90, borderRadius: "50%",
                            background: profileImg ? `url(${profileImg}) center/cover no-repeat` : `linear-gradient(145deg, ${T.rose}44, ${T.plum}44, ${T.amber}33)`,
                            border: `3px solid ${T.rose}66`,
                            boxShadow: `0 4px 20px ${T.rose}22, 0 0 0 4px ${T.roseBg}`,
                            display: "flex", alignItems: "center", justifyContent: "center",
                            transition: "all 0.3s",
                            overflow: "hidden",
                        }}>
                            {!profileImg && (
                                <svg width="44" height="44" viewBox="0 0 24 24" fill="none">
                                    <circle cx="12" cy="8" r="4" fill={T.rose} opacity="0.7" />
                                    <path d="M4 20c0-3.3 2.7-6 6-6h4c3.3 0 6 2.7 6 6" stroke={T.rose} strokeWidth="1.5" fill={T.rose} opacity="0.35" strokeLinecap="round" />
                                </svg>
                            )}
                        </div>
                        {/* Camera badge */}
                        <div style={{
                            position: "absolute", bottom: 0, right: 0,
                            width: 28, height: 28, borderRadius: "50%",
                            background: T.rose, border: `2px solid ${T.cream}`,
                            display: "flex", alignItems: "center", justifyContent: "center",
                            boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
                        }}>
                            <span style={{ fontSize: 14 }}>📷</span>
                        </div>
                    </label>
                    <p style={{ color: T.textMid, fontSize: 12, marginTop: 8, fontWeight: 600 }}>
                        {profile.name || "اضغطي لإضافة صورتك"}
                    </p>
                </div>
                {[{ label: "الاسم", key: "name", type: "text", ph: "اسمك" }, { label: "العمر", key: "age", type: "number", ph: "عمرك" }].map(f => (
                    <div key={f.key}>
                        <p style={{ fontSize: 11, color: T.textDim }}>{f.label}</p>
                        <input type={f.type} value={profile[f.key] || ""} placeholder={f.ph}
                            onChange={e => setProfile(p => ({ ...p, [f.key]: e.target.value }))} style={inp} />
                    </div>
                ))}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                    {[{ label: "الوزن (كغ)", key: "weight" }, { label: "الطول (سم)", key: "height" }].map(f => (
                        <div key={f.key}>
                            <p style={{ fontSize: 11, color: T.textDim }}>{f.label}</p>
                            <input type="number" value={profile[f.key] || ""} placeholder={f.label}
                                onChange={e => setProfile(p => ({ ...p, [f.key]: e.target.value }))} style={{ ...inp, marginBottom: 0 }} />
                        </div>
                    ))}
                </div>
                {bmi && (
                    <div style={{ marginTop: 12, padding: "10px 14px", background: T.amberBg, borderRadius: 12, border: `1px solid ${T.amber}33` }}>
                        <Row style={{ justifyContent: "space-between" }}>
                            <span style={{ color: T.textMid, fontSize: 13 }}>مؤشر كتلة الجسم</span>
                            <span style={{ color: T.amber, fontWeight: 900, fontSize: 18 }}>{bmi}</span>
                        </Row>
                        <p style={{ color: T.textMuted, fontSize: 11, marginTop: 2 }}>
                            {bmi < 18.5 ? "نحافة 🔻" : bmi < 25 ? "وزن طبيعي ✅" : bmi < 30 ? "وزن زائد ⚠️" : "سمنة ⚠️"}
                        </p>
                    </div>
                )}
            </Card>

            {/* Doctor */}
            <Card style={{ border: `1.5px solid ${T.amber}44`, background: T.amberBg }}>
                <Row style={{ marginBottom: 10, alignItems: "center" }}>
                    <SLabel color={T.amber}>👩‍⚕️ تواصلي مع طبيبتك</SLabel>
                    <span style={{ marginRight: "auto", fontSize: 10, background: T.amber + "22", color: T.amber, borderRadius: 20, padding: "2px 10px", fontWeight: 800, whiteSpace: "nowrap" }}>VIP ⭐</span>
                </Row>
                {[
                    { label: "اسم الطبيبة", key: "doctorName", type: "text" },
                    { label: "واتساب / هاتف", key: "doctorPhone", type: "tel" },
                    { label: "البريد الإلكتروني", key: "doctorEmail", type: "email" },
                    { label: "ملاحظات للطبيبة", key: "doctorNote", type: "text" },
                ].map(f => (
                    <div key={f.key}>
                        <p style={{ fontSize: 11, color: T.textDim }}>{f.label}</p>
                        <input type={f.type} value={profile[f.key] || ""} placeholder={f.label}
                            onChange={e => setProfile(p => ({ ...p, [f.key]: e.target.value }))} style={{ ...inp, background: T.cream }} />
                    </div>
                ))}
                <button onClick={() => alert(`سيتم إرسال ملخص صحتك إلى ${profile.doctorName || "طبيبتك"} 📤`)}
                    style={{ width: "100%", padding: "12px 0", background: T.amber, color: "#fff", border: "none", borderRadius: 14, fontWeight: 900, fontSize: 14, cursor: "pointer" }}>
                    📤 إرسال ملخصك الصحي للطبيبة
                </button>
            </Card>

            {/* Notifications */}
            <Card>
                <SLabel color={T.plum}>🔔 التنبيهات</SLabel>
                {[
                    { key: "prePeriod", label: "تنبيه قبل الدورة بيوم 📅", color: T.rose },
                    { key: "delay", label: "تنبيه عند تأخر الدورة ⚠️", color: T.amber },
                    { key: "ovulation", label: "تذكير يوم التبويض المتوقع ✨", color: T.sage },
                ].map(n => (
                    <Row key={n.key} style={{ justifyContent: "space-between", marginBottom: 14 }}>
                        <span style={{ color: T.textMid, fontSize: 13 }}>{n.label}</span>
                        <Toggle on={notif[n.key]} onToggle={() => setNotif(p => ({ ...p, [n.key]: !p[n.key] }))} color={n.color} />
                    </Row>
                ))}
                <p style={{ fontSize: 11, color: T.textDim }}>* التنبيهات تحتاج إذن الإشعارات من المتصفح</p>
            </Card>

            {/* Ovulation tests */}
            <Card>
                <SLabel color={PHASES.ovulation.color}>🥚 اختبارات التبويض</SLabel>
                <p style={{ fontSize: 11, color: T.textDim, marginBottom: 4 }}>تاريخ الاختبار</p>
                <input type="date" value={testDate} onChange={e => setTestDate(e.target.value)}
                    style={{ ...inp, direction: "ltr" }} />
                <p style={{ fontSize: 11, color: T.textDim, marginBottom: 4 }}>النتيجة</p>
                <select value={testResult} onChange={e => setTestResult(e.target.value)}
                    style={{ ...inp, appearance: "none", marginBottom: 12 }}>
                    {OVU_TESTS.map(t => <option key={t}>{t}</option>)}
                </select>
                <button onClick={addTest} style={{ width: "100%", padding: "11px 0", background: T.amberBg, color: T.amber, border: `1.5px solid ${T.amber}55`, borderRadius: 14, fontWeight: 900, fontSize: 14, cursor: "pointer", marginBottom: 12 }}>
                    + تسجيل نتيجة جديدة
                </button>
                {ovulationTests.length === 0
                    ? <p style={{ color: T.textDim, fontSize: 13, textAlign: "center" }}>لا توجد نتائج بعد</p>
                    : ovulationTests.map((t, i) => (
                        <Row key={i} style={{ justifyContent: "space-between", padding: "8px 0", borderBottom: `1px solid ${T.borderLight}` }}>
                            <span style={{ color: T.textMuted, fontSize: 12, direction: "ltr" }}>{t.date}</span>
                            <span style={{ color: T.amber, fontWeight: 800, fontSize: 13 }}>{t.result}</span>
                        </Row>
                    ))}
            </Card>

            {/* History */}
            <Card>
                <SLabel color={T.rose}>📋 سجل الدورات</SLabel>
                {cycleHistory.map((c, i) => (
                    <Row key={i} style={{ justifyContent: "space-between", padding: "8px 0", borderBottom: `1px solid ${T.borderLight}` }}>
                        <span style={{ color: T.textMuted, fontSize: 13, direction: "ltr" }}>{c.date}</span>
                        <span style={{ color: T.rose, fontWeight: 800, fontSize: 13 }}>الدورة {i + 1}</span>
                    </Row>
                ))}
            </Card>
        </div>
    );
}

// ─── MAIN ───────────────────────────────────────────────────────────────────
const TABS = [
    { key: "cycle", icon: "🌸", label: "دورتي", accent: T.rose },
    { key: "home", icon: "🏠", label: "الرئيسية", accent: T.amber },
    { key: "tracking", icon: "📊", label: "تتبع", accent: T.sage },
    { key: "tips", icon: "💡", label: "نصائح", accent: T.amber },
    { key: "settings", icon: "⚙️", label: "إعدادات", accent: T.plum },
];

export default function App() {
    const [tab, setTab] = useState("home");
    const [cycleInput, setCycleInput] = useState({ lastPeriod: "", cycleLen: 28, periodLen: 5 });
    const [symptoms, setSymptoms] = useState([]);
    const [tracking, setTracking] = useState({ water: 0, sleep: 7, mood: "", totalCal: 0, meals: [], weight: "" });
    const [profile, setProfile] = useState({});
    const [ovulationTests, setOvulationTests] = useState([]);
    const cycleHistory = [{ date: "2025-12-01" }, { date: "2026-01-02" }, { date: "2026-02-01" }];
    const cycleData = calcPhase(cycleInput.lastPeriod, cycleInput.cycleLen, cycleInput.periodLen);
    const toggleSymptom = s => setSymptoms(p => p.includes(s) ? p.filter(x => x !== s) : [...p, s]);

    useEffect(() => {
        const el = document.getElementById("lotus-scroll");
        if (el) el.scrollTop = 0;
    }, [tab]);

    const currentTab = TABS.find(t => t.key === tab);

    return (
        <div style={{ minHeight: "100vh", background: `linear-gradient(160deg, #EDE4D8 0%, #F5EFE6 50%, #E8DDD0 100%)`, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Segoe UI', Tahoma, Arial, sans-serif", direction: "rtl" }}>

            <style>{`
        #lotus-scroll::-webkit-scrollbar { display:none; }
        input[type=range] { -webkit-appearance:none; height:6px; border-radius:6px; background:${T.surface2}; }
        input[type=range]::-webkit-slider-thumb { -webkit-appearance:none; width:20px; height:20px; border-radius:50%; background:${T.cream}; box-shadow:0 2px 8px rgba(100,70,40,0.25); cursor:pointer; border:2px solid currentColor; }
        input::placeholder { color:${T.textDim}; }
        select option { background:${T.surface2}; color:${T.text}; }
      `}</style>

            {/* Phone shell */}
            <div style={{ width: 375, height: 812, background: T.bg, borderRadius: 44, overflow: "hidden", display: "flex", flexDirection: "column", boxShadow: `0 0 0 8px ${T.surface3}, 0 0 0 11px ${T.border}, 0 30px 60px rgba(80,50,20,0.25)`, position: "relative" }}>

                {/* Status bar */}
                <div style={{ background: T.cream, padding: "14px 22px 0", display: "flex", flexDirection: "column", alignItems: "center", borderBottom: `1px solid ${T.borderLight}` }}>
                    {/* notch */}
                    <div style={{ width: 80, height: 22, background: T.surface3, borderRadius: 11, marginBottom: 10 }} />
                    <div style={{ display: "flex", justifyContent: "space-between", width: "100%", paddingBottom: 10 }}>
                        <span style={{ fontSize: 14, color: T.rose, fontWeight: 900, letterSpacing: 0.5 }}>Lotus 🌸</span>
                        <span style={{ fontSize: 11, color: T.textDim }}>{new Date().toLocaleDateString("ar-SA", { weekday: "short", day: "numeric", month: "short" })}</span>
                    </div>
                </div>

                {/* Content */}
                <div id="lotus-scroll" style={{ flex: 1, overflowY: "auto", padding: "12px 14px 90px", scrollbarWidth: "none" }}>
                    {tab === "home" && <HomeTab cycleData={cycleData} tracking={tracking} cycleInput={cycleInput} />}
                    {tab === "cycle" && <CycleTab cycleData={cycleData} cycleInput={cycleInput} setCycleInput={setCycleInput} symptoms={symptoms} toggleSymptom={toggleSymptom} onSaveOvuTest={r => setOvulationTests(p => [r, ...p])} />}
                    {tab === "tracking" && <TrackingTab tracking={tracking} setTracking={setTracking} />}
                    {tab === "tips" && <TipsTab phase={cycleData.phase} />}
                    {tab === "settings" && <SettingsTab profile={profile} setProfile={setProfile} cycleHistory={cycleHistory} ovulationTests={ovulationTests} setOvulationTests={setOvulationTests} />}
                </div>

                {/* Bottom Nav */}
                <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, background: T.cream, borderTop: `1px solid ${T.borderLight}`, display: "flex", padding: "10px 0 18px", boxShadow: `0 -4px 20px rgba(100,70,40,0.08)` }}>
                    {TABS.map(t => {
                        const active = tab === t.key;
                        return (
                            <button key={t.key} onClick={() => setTab(t.key)}
                                style={{ flex: 1, background: "none", border: "none", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 3, paddingTop: 4 }}>
                                <span style={{ fontSize: 20, filter: active ? "none" : "grayscale(1) opacity(0.35)", transition: "all 0.2s", transform: active ? "scale(1.12)" : "scale(1)" }}>{t.icon}</span>
                                <span style={{ fontSize: 9, color: active ? t.accent : T.textDim, fontWeight: active ? 900 : 400, transition: "color 0.2s" }}>{t.label}</span>
                                {active && <div style={{ width: 22, height: 3, background: t.accent, borderRadius: 2, marginTop: 1 }} />}
                            </button>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}
