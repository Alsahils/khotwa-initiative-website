"use client";

import { useState, useRef, useCallback, FormEvent, ChangeEvent, DragEvent } from "react";
import Link from "next/link";
import Image from "next/image";
import { Lock, CheckCircle, UploadCloud } from "lucide-react";
import { useLanguage } from "@/components/LanguageProvider";
import { supabase } from "@/lib/supabase";

const TOTAL_STEPS = 6;

export default function RegisterPage() {
  const { lang, t, toggleLang } = useLanguage();

  // --- State ---
  const isRegistrationOpen = true;

  const [currentStep, setCurrentStep] = useState(0);
  const [showSuccess, setShowSuccess] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  // Form data
  const [fullNameAr, setFullNameAr] = useState("");
  const [fullNameEn, setFullNameEn] = useState("");
  const [uniId, setUniId] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [gender, setGender] = useState("");
  const [major, setMajor] = useState("");
  const [cvFile, setCvFile] = useState<File | null>(null);

  // Refs for validation
  const formRef = useRef<HTMLFormElement>(null);

  // --- Majors based on gender ---
  const getMajors = useCallback(() => {
    const base = [
      { value: "", label: t("regMajorPlaceholder"), disabled: true },
      { value: "software_engineering", label: t("regMajorSE") },
      { value: "computer_science", label: t("regMajorCS") },
      { value: "information_systems", label: t("regMajorIS") },
    ];

    if (gender === "male") {
      base.push({ value: "computer_engineering", label: t("regMajorCE"), disabled: false });
    } else if (gender === "female") {
      base.push({ value: "information_technology", label: t("regMajorIT"), disabled: false });
    } else {
      base.push({ value: "computer_engineering", label: t("regMajorCE"), disabled: false });
      base.push({ value: "information_technology", label: t("regMajorIT"), disabled: false });
    }

    return base;
  }, [gender, t]);

  // --- Validation ---
  const validateCurrentStep = (): boolean => {
    switch (currentStep) {
      case 0: {
        const arPattern = /^[\u0600-\u06FF\s]+$/;
        const enPattern = /^[a-zA-Z\s]+$/;
        if (!fullNameAr.trim() || !arPattern.test(fullNameAr)) {
          alert(lang === "ar" ? "الرجاء إدخال الاسم باللغة العربية فقط" : "Please enter the name in Arabic only");
          return false;
        }
        if (!fullNameEn.trim() || !enPattern.test(fullNameEn)) {
          alert(lang === "ar" ? "يرجى إدخال الاسم بالإنجليزية فقط" : "Please use English characters only");
          return false;
        }
        return true;
      }
      case 1: {
        const idPattern = /^4[0-9]{8}$/;
        if (!idPattern.test(uniId)) {
          alert(lang === "ar" ? "يجب أن يتكون الرقم الجامعي من 9 أرقام ويبدأ بـ 4" : "University ID must be 9 digits starting with 4");
          return false;
        }
        return true;
      }
      case 2:
        if (!birthDate) {
          alert(lang === "ar" ? "يرجى اختيار تاريخ الميلاد" : "Please select a birth date");
          return false;
        }
        return true;
      case 3:
        if (!gender) {
          alert(lang === "ar" ? "يرجى تحديد الجنس" : "Please select your gender");
          return false;
        }
        return true;
      case 4:
        if (!major) {
          alert(lang === "ar" ? "يرجى اختيار التخصص" : "Please select your major");
          return false;
        }
        return true;
      case 5:
        if (!cvFile) {
          alert(lang === "ar" ? "يرجى رفع السيرة الذاتية" : "Please upload your CV");
          return false;
        }
        return true;
      default:
        return true;
    }
  };

  // --- Navigation ---
  const goNext = () => {
    if (validateCurrentStep() && currentStep < TOTAL_STEPS - 1) {
      setCurrentStep((s) => s + 1);
    }
  };

  const goPrev = () => {
    if (currentStep > 0) {
      setCurrentStep((s) => s - 1);
    }
  };

  // --- File handling ---
  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null;
    setCvFile(file);
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      setCvFile(file);
    }
  };

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(true);
  };

  const handleDragLeave = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);
  };

  // --- Submit ---
  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (currentStep !== TOTAL_STEPS - 1 || !validateCurrentStep()) return;

    setIsSubmitting(true);

    try {
      if (!cvFile) throw new Error("CV file is required.");

      // 1. Upload CV to Supabase Storage
      const safeFileName = cvFile.name.replace(/[^a-zA-Z0-9.\-_]/g, "_");
      const uniqueFileName = `${Date.now()}_${safeFileName}`;

      const { error: uploadError } = await supabase.storage
        .from("cv_uploads")
        .upload(uniqueFileName, cvFile, {
          cacheControl: "3600",
          upsert: false,
        });

      if (uploadError) {
        // Provide a descriptive error when the storage bucket is missing so
        // that developers know exactly what needs to be fixed.
        const isBucketMissing =
          uploadError.message?.toLowerCase().includes("bucket not found") ||
          (uploadError as { statusCode?: string }).statusCode === "404";

        if (isBucketMissing) {
          throw new Error(
            lang === "ar"
              ? "مساحة التخزين غير مهيأة. يرجى التواصل مع الدعم الفني."
              : "Storage is not configured yet. Please run `npm run setup:supabase` to initialize the Supabase storage bucket, then re-deploy."
          );
        }

        throw uploadError;
      }

      // 2. Get public URL
      const { data: publicUrlData } = supabase.storage
        .from("cv_uploads")
        .getPublicUrl(uniqueFileName);

      const cv_url = publicUrlData.publicUrl;

      // 3. Insert registration record
      const { error: dbError } = await supabase.from("registrations").insert([
        {
          name_ar: fullNameAr,
          name_en: fullNameEn,
          uni_id: uniId,
          gender,
          birthdate: birthDate,
          major,
          cv_url,
        },
      ]);

      if (dbError) throw dbError;

      // 4. Success
      setShowSuccess(true);
    } catch (error: unknown) {
      console.error("Registration Error:", error);
      const msg =
        lang === "ar"
          ? "حدث خطأ أثناء التسجيل. يرجى المحاولة مرة أخرى."
          : "An error occurred during registration. Please try again.";
      const devMsg = error instanceof Error ? error.message : JSON.stringify(error);
      alert(`${msg}\n\n${devMsg}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  // --- Max birth date (18 years ago) ---
  const maxBirthDate = (() => {
    const d = new Date();
    d.setFullYear(d.getFullYear() - 18);
    return d.toISOString().split("T")[0];
  })();

  // --- Progress ---
  const progressPercent = ((currentStep + 1) / TOTAL_STEPS) * 100;

  // --- Closed View ---
  if (!isRegistrationOpen) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="animated-bg" />
        <div className="relative z-10 bg-white/95 backdrop-blur-xl border border-white/40 rounded-3xl shadow-xl p-10 max-w-lg w-full text-center">
          <div className="w-20 h-20 bg-brand/5 rounded-full flex items-center justify-center mx-auto mb-6">
            <Lock className="w-9 h-9 text-brand" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-3">{t("regUnavailableTitle")}</h1>
          <p className="text-gray-500 text-lg mb-8 leading-relaxed">{t("regUnavailableDesc")}</p>
          <Link
            href="/"
            className="inline-block bg-gray-900 text-white px-8 py-3 rounded-full font-semibold hover:bg-black transition shadow-md"
          >
            {t("goBackHome")}
          </Link>
        </div>
      </div>
    );
  }

  // --- Success View ---
  if (showSuccess) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="animated-bg" />
        <div className="relative z-10 bg-white/95 backdrop-blur-xl border border-white/40 rounded-3xl shadow-xl p-10 max-w-lg w-full text-center">
          <div className="w-20 h-20 bg-green-50 rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircle className="w-12 h-12 text-green-500" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-3">{t("regSuccessTitle")}</h1>
          <p className="text-gray-500 text-lg mb-8 leading-relaxed">{t("regSuccessDesc")}</p>
          <Link
            href="/"
            className="inline-block bg-brand text-white px-8 py-3 rounded-full font-semibold hover:bg-brand-light transition shadow-md shadow-brand/20"
          >
            {t("regReturnHome")}
          </Link>
        </div>
      </div>
    );
  }

  // --- Form View ---
  return (
    <div className="min-h-screen flex flex-col items-center p-4 pt-8 pb-12 relative">
      <div className="animated-bg" />

      <div className="relative z-10 w-full max-w-[580px]">
        {/* Header */}
        <header className="flex justify-center items-center relative mb-12">
          <Link href="/" className="inline-block z-10 hover:scale-105 transition-transform">
            <Image
              src="/image/khotwa-logo.png"
              alt="Khotwa Logo"
              width={120}
              height={120}
              className="h-28 w-auto object-contain drop-shadow-md"
            />
          </Link>
          <button
            onClick={toggleLang}
            type="button"
            className="absolute start-0 top-1/2 -translate-y-1/2 bg-white/80 backdrop-blur-md border border-gray-200 rounded-full px-4 py-2 text-sm font-semibold text-gray-800 hover:text-brand hover:border-brand transition z-10"
          >
            {lang === "ar" ? "English" : "عربي"}
          </button>
        </header>

        {/* Card */}
        <div className="bg-white/95 backdrop-blur-xl border border-white/40 rounded-3xl shadow-xl p-8 md:p-10">
          {/* Progress */}
          <div className="mb-8">
            <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden mb-3">
              <div
                className={`h-full bg-brand rounded-full transition-all duration-500 ease-out ${lang === "ar" ? "float-right" : ""}`}
                style={{ width: `${progressPercent}%` }}
              />
            </div>
            <p className="text-sm text-gray-400 font-semibold uppercase tracking-wider">
              {t("stepWord")} {currentStep + 1} / {TOTAL_STEPS}
            </p>
          </div>

          <form ref={formRef} onSubmit={handleSubmit}>
            {/* Step 1: Names */}
            {currentStep === 0 && (
              <div className="step-card active">
                <h2 className="text-2xl font-bold text-gray-900 mb-2">{t("regStep1Title")}</h2>
                <p className="text-gray-500 text-lg mb-8">{t("regStep1Desc")}</p>

                <div className="mb-5">
                  <label htmlFor="fullNameAr" className="block text-sm font-semibold text-gray-800 mb-2">
                    {t("regFullNameAr")}
                  </label>
                  <input
                    type="text"
                    id="fullNameAr"
                    value={fullNameAr}
                    onChange={(e) => setFullNameAr(e.target.value)}
                    placeholder={t("regFullNameArPlaceholder")}
                    className="w-full px-4 py-3.5 text-lg border-2 border-gray-200 rounded-xl bg-gray-50 focus:bg-white focus:border-brand focus:ring-4 focus:ring-brand/10 outline-none transition"
                    required
                    dir="rtl"
                  />
                </div>

                <div className="mb-2">
                  <label htmlFor="fullNameEn" className="block text-sm font-semibold text-gray-800 mb-2">
                    {t("regFullNameEn")}
                  </label>
                  <input
                    type="text"
                    id="fullNameEn"
                    value={fullNameEn}
                    onChange={(e) => setFullNameEn(e.target.value)}
                    placeholder={t("regFullNameEnPlaceholder")}
                    className="w-full px-4 py-3.5 text-lg border-2 border-gray-200 rounded-xl bg-gray-50 focus:bg-white focus:border-brand focus:ring-4 focus:ring-brand/10 outline-none transition"
                    required
                    dir="ltr"
                  />
                </div>
              </div>
            )}

            {/* Step 2: Uni ID */}
            {currentStep === 1 && (
              <div className="step-card active">
                <h2 className="text-2xl font-bold text-gray-900 mb-2">{t("regStep2Title")}</h2>
                <p className="text-gray-500 text-lg mb-8">{t("regStep2Desc")}</p>

                <div className="mb-2">
                  <label htmlFor="uniId" className="block text-sm font-semibold text-gray-800 mb-2">
                    {t("regUniId")}
                  </label>
                  <input
                    type="text"
                    id="uniId"
                    value={uniId}
                    onChange={(e) => setUniId(e.target.value)}
                    placeholder={t("regUniIdPlaceholder")}
                    className="w-full px-4 py-3.5 text-lg border-2 border-gray-200 rounded-xl bg-gray-50 focus:bg-white focus:border-brand focus:ring-4 focus:ring-brand/10 outline-none transition"
                    required
                    dir="ltr"
                  />
                </div>
              </div>
            )}

            {/* Step 3: Birth Date */}
            {currentStep === 2 && (
              <div className="step-card active">
                <h2 className="text-2xl font-bold text-gray-900 mb-2">{t("regStep3Title")}</h2>
                <p className="text-gray-500 text-lg mb-8">{t("regStep3Desc")}</p>

                <div className="mb-2">
                  <label htmlFor="birthDate" className="block text-sm font-semibold text-gray-800 mb-2">
                    {t("regBirthDate")}
                  </label>
                  <input
                    type="date"
                    id="birthDate"
                    value={birthDate}
                    onChange={(e) => setBirthDate(e.target.value)}
                    max={maxBirthDate}
                    className="w-full px-4 py-3.5 text-lg border-2 border-gray-200 rounded-xl bg-gray-50 focus:bg-white focus:border-brand focus:ring-4 focus:ring-brand/10 outline-none transition"
                    required
                  />
                </div>
              </div>
            )}

            {/* Step 4: Gender */}
            {currentStep === 3 && (
              <div className="step-card active">
                <h2 className="text-2xl font-bold text-gray-900 mb-2">{t("regStep4Title")}</h2>
                <p className="text-gray-500 text-lg mb-8">{t("regStep4Desc")}</p>

                <div className="mb-2">
                  <label className="block text-sm font-semibold text-gray-800 mb-4">
                    {t("regGender")}
                  </label>
                  <div className="flex gap-8">
                    {[
                      { value: "male", labelKey: "regMale" },
                      { value: "female", labelKey: "regFemale" },
                    ].map((opt) => (
                      <label
                        key={opt.value}
                        className="flex items-center cursor-pointer text-lg font-medium text-gray-800 relative"
                      >
                        <input
                          type="radio"
                          name="gender"
                          value={opt.value}
                          checked={gender === opt.value}
                          onChange={(e) => {
                            setGender(e.target.value);
                            setMajor(""); // Reset major when gender changes
                          }}
                          className="absolute opacity-0 cursor-pointer"
                          required
                        />
                        <span className="custom-radio" />
                        <span>{t(opt.labelKey)}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Step 5: Major */}
            {currentStep === 4 && (
              <div className="step-card active">
                <h2 className="text-2xl font-bold text-gray-900 mb-2">{t("regStep5Title")}</h2>
                <p className="text-gray-500 text-lg mb-8">{t("regStep5Desc")}</p>

                <div className="mb-2">
                  <label htmlFor="major" className="block text-sm font-semibold text-gray-800 mb-2">
                    {t("regMajor")}
                  </label>
                  <select
                    id="major"
                    value={major}
                    onChange={(e) => setMajor(e.target.value)}
                    className="w-full px-4 py-3.5 text-lg border-2 border-gray-200 rounded-xl bg-gray-50 focus:bg-white focus:border-brand focus:ring-4 focus:ring-brand/10 outline-none transition appearance-none"
                    required
                  >
                    {getMajors().map((opt) => (
                      <option key={opt.value} value={opt.value} disabled={opt.disabled}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            )}

            {/* Step 6: CV Upload */}
            {currentStep === 5 && (
              <div className="step-card active">
                <h2 className="text-2xl font-bold text-gray-900 mb-2">{t("regStep6Title")}</h2>
                <p className="text-gray-500 text-lg mb-8">{t("regStep6Desc")}</p>

                <div
                  className={`file-drop-area ${dragOver ? "dragover" : ""}`}
                  onDrop={handleDrop}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                >
                  <UploadCloud className="w-12 h-12 text-gray-400 mb-4 transition-colors group-hover:text-brand" />
                  <span
                    className={`text-lg font-semibold mb-2 break-all ${
                      cvFile ? "text-brand" : "text-gray-800"
                    }`}
                  >
                    {cvFile ? cvFile.name : t("regFileMsg")}
                  </span>
                  <span className="text-sm text-gray-400">{t("regFileFormat")}</span>
                  <input
                    type="file"
                    accept=".pdf,image/jpeg,image/png"
                    onChange={handleFileChange}
                    required
                  />
                </div>
              </div>
            )}

            {/* Navigation */}
            <div className="flex items-center mt-10 pt-6 border-t border-gray-100">
              {currentStep > 0 ? (
                <button
                  type="button"
                  onClick={goPrev}
                  className="px-6 py-3 text-base font-semibold rounded-full text-gray-500 hover:bg-gray-100 hover:text-gray-800 transition"
                >
                  {t("regBtnPrev")}
                </button>
              ) : (
                <div />
              )}

              <div className="flex-1" />

              {currentStep < TOTAL_STEPS - 1 ? (
                <button
                  type="button"
                  onClick={goNext}
                  className="px-8 py-3 text-base font-semibold rounded-full bg-brand text-white hover:bg-brand-light transition shadow-md shadow-brand/25 hover:shadow-lg hover:-translate-y-0.5"
                >
                  {t("regBtnNext")}
                </button>
              ) : (
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-8 py-3 text-base font-semibold rounded-full bg-brand text-white hover:bg-brand-light transition shadow-md shadow-brand/25 hover:shadow-lg hover:-translate-y-0.5 disabled:opacity-70 disabled:cursor-not-allowed"
                >
                  {isSubmitting ? t("regBtnUploading") : t("regBtnSubmit")}
                </button>
              )}
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
