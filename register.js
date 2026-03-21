/**
 * Registration Form Logic with strict validation and custom UI
 */

// --- Supabase Setup ---
const SUPABASE_URL = 'https://teuhmjohpbxjqmenwrzs.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRldWhtam9ocGJ4anFtZW53cnpzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwODgyNDUsImV4cCI6MjA4OTY2NDI0NX0.tlO-zMLSW6r9a6R-9winqB84E4ZLTF152R6CqxQ5bss';
let supabase = null; // initialized securely in submit handler

document.addEventListener('DOMContentLoaded', () => {
    // --- 1. State Management (Open/Closed Toggle) ---
    const isRegistrationOpen = true;

    // DOM Elements
    const closedContainer = document.getElementById('closed-container');
    const formContainer = document.getElementById('form-container');
    const successContainer = document.getElementById('success-container');

    // Step elements
    const steps = [
        document.getElementById('step-1'),
        document.getElementById('step-2'),
        document.getElementById('step-3'),
        document.getElementById('step-4'),
        document.getElementById('step-5'),
        document.getElementById('step-6')
    ];

    // Navigation Elements
    const btnPrev = document.getElementById('btn-prev');
    const btnNext = document.getElementById('btn-next');
    const btnSubmit = document.getElementById('btn-submit');
    const progressBar = document.getElementById('progress-bar');
    const currentStepText = document.getElementById('current-step-text');

    // Form and inputs
    const fileInput = document.getElementById('cvUpload');
    const fileMsg = document.querySelector('.file-msg');
    const fileDropArea = document.getElementById('file-drop-area');
    const form = document.getElementById('registration-form');

    // Gender radios
    const genderRadios = document.querySelectorAll('input[name="gender"]');
    const majorSelectEl = document.getElementById('major');

    // Choices.js Init safely
    let majorChoices = null;
    try {
        majorChoices = new Choices(majorSelectEl, {
            searchEnabled: false,
            itemSelectText: '',
            shouldSort: false,
            placeholder: true
        });
    } catch (e) {
        console.warn('Choices.js failed to load. Falling back to native select.', e);
    }

    // Form state
    let currentStepIndex = 0;

    // Translation handling
    const langToggleBtn = document.getElementById('lang-toggle');
    let currentLang = localStorage.getItem('khotwa_lang') || 'ar';

    // 18 Years ago logic for Flatpickr safely
    let fp = null;
    function initFlatpickr(lang) {
        try {
            const eighteenYearsAgo = new Date();
            eighteenYearsAgo.setFullYear(eighteenYearsAgo.getFullYear() - 18);

            if (fp) fp.destroy();
            let safeLocale = (typeof flatpickr !== 'undefined' && flatpickr.l10ns && flatpickr.l10ns.ar && lang === 'ar') ? 'ar' : 'en';

            fp = flatpickr("#birthDate", {
                locale: safeLocale,
                dateFormat: "Y-m-d",
                maxDate: eighteenYearsAgo,
                disableMobile: "true",
                onChange: function (selectedDates, dateStr, instance) {
                    document.getElementById('birthDate').setCustomValidity('');
                }
            });
        } catch (e) {
            console.warn('Flatpickr failed to load. Falling back to native date picker.', e);
        }
    }

    // Choices Logic Based on Gender and Language
    function getMajors(gender, lang) {
        const t = (typeof translations !== 'undefined' && translations[lang]) ? translations[lang] : {};
        let options = [
            { value: '', label: t['regMajorPlaceholder'] || 'Select Major...', disabled: true, selected: true },
            { value: 'software_engineering', label: t['regMajorSE'] || 'Software Engineering' },
            { value: 'computer_science', label: t['regMajorCS'] || 'Computer Science' },
            { value: 'information_systems', label: t['regMajorIS'] || 'Information Systems' }
        ];

        // Specific rules: Female = NO COE, Male = NO IT
        if (gender === 'male') {
            options.push({ value: 'computer_engineering', label: t['regMajorCE'] || 'Computer Engineering' });
        } else if (gender === 'female') {
            options.push({ value: 'information_technology', label: t['regMajorIT'] || 'Information Technology' });
        } else {
            // Show both so placeholder UI behaves, since gender is step 4, step 5 depends on it. Ideally gender is always picked.
            options.push({ value: 'computer_engineering', label: t['regMajorCE'] || 'Computer Engineering' });
            options.push({ value: 'information_technology', label: t['regMajorIT'] || 'Information Technology' });
        }

        return options;
    }

    function updateChoices(gender, lang) {
        const currentVal = majorSelectEl.value;
        const newOptions = getMajors(gender, lang);

        if (!majorChoices) {
            // Fallback for native select
            majorSelectEl.innerHTML = '';
            newOptions.forEach(opt => {
                const o = document.createElement('option');
                o.value = opt.value;
                o.textContent = opt.label;
                o.disabled = opt.disabled || false;
                if(opt.value === currentVal || opt.selected) o.selected = true;
                majorSelectEl.appendChild(o);
            });
            return;
        }

        // Retain picked valid value
        const validValues = newOptions.map(o => o.value);
        let selectedVal = (validValues.includes(currentVal) && currentVal !== '') ? currentVal : '';

        majorChoices.clearStore();
        try {
            majorChoices.setChoices(
                newOptions.map(opt => ({
                    value: opt.value,
                    label: opt.label,
                    selected: opt.value === selectedVal,
                    disabled: opt.disabled || false
                })),
                'value', 'label', true
            );
        } catch (e) {}
    }

    function getCurrentGender() {
        let val = null;
        genderRadios.forEach(r => { if (r.checked) val = r.value; });
        return val;
    }

    // Gender trigger
    genderRadios.forEach(radio => {
        radio.addEventListener('change', (e) => {
            updateChoices(getCurrentGender(), currentLang);
        });
    });

    // Language processing
    function updateLanguage(lang) {
        document.documentElement.lang = lang;
        document.documentElement.dir = (lang === 'ar') ? 'rtl' : 'ltr';
        langToggleBtn.textContent = (lang === 'ar') ? 'English' : 'عربي';
        document.getElementById('step-word').textContent = (lang === 'ar') ? 'الخطوة' : 'Step';

        if (typeof translations !== 'undefined' && translations[lang]) {
            const elements = document.querySelectorAll('[data-i18n]');
            elements.forEach(el => {
                const key = el.getAttribute('data-i18n');
                if (translations[lang][key]) {
                    if (el.tagName === 'INPUT' && el.type === 'text') {
                        el.value = el.value; // Trigger view
                    } else if (el.tagName === 'OPTION') {
                        el.textContent = translations[lang][key];
                    } else {
                        el.textContent = translations[lang][key];
                    }
                }
            });
            const placeholders = document.querySelectorAll('[data-i18n-placeholder]');
            placeholders.forEach(el => {
                const key = el.getAttribute('data-i18n-placeholder');
                if (translations[lang][key]) {
                    el.placeholder = translations[lang][key];
                }
            });
        }
    }

    langToggleBtn.addEventListener('click', () => {
        currentLang = currentLang === 'ar' ? 'en' : 'ar';
        localStorage.setItem('khotwa_lang', currentLang);
        updateLanguage(currentLang);
        initFlatpickr(currentLang);
        updateChoices(getCurrentGender(), currentLang);
    });

    if (typeof translations !== 'undefined') {
        updateLanguage(currentLang);
    }

    // Init libraries and logic once
    initFlatpickr(currentLang);
    updateChoices(getCurrentGender(), currentLang);

    // Declare updateView early so it can be used
    function updateView() {
        steps.forEach((step, index) => {
            if (index === currentStepIndex) {
                step.classList.add('active');
                step.style.animation = 'none';
                step.offsetHeight;
                step.style.animation = null;
            } else {
                step.classList.remove('active');
            }
        });

        // Update progress bar
        const progressPercent = ((currentStepIndex + 1) / steps.length) * 100;
        progressBar.style.width = `${progressPercent}%`;
        currentStepText.textContent = currentStepIndex + 1;

        // Handle button visibility
        if (currentStepIndex === 0) {
            btnPrev.classList.add('hidden');
        } else {
            btnPrev.classList.remove('hidden');
        }

        if (currentStepIndex === steps.length - 1) {
            btnNext.classList.add('hidden');
            btnSubmit.classList.remove('hidden');
        } else {
            btnNext.classList.remove('hidden');
            btnSubmit.classList.add('hidden');
        }

        // Auto focus
        const currentInput = steps[currentStepIndex].querySelector('input');
        if (currentInput && currentStepIndex !== 5 && currentStepIndex !== 3 && currentStepIndex !== 4) {
            setTimeout(() => currentInput.focus(), 100);
        }
    }

    // Initialize the appropriate view FIRST to guarantee it shows
    if (!isRegistrationOpen) {
        closedContainer.classList.remove('hidden');
        formContainer.classList.add('hidden');
        successContainer.classList.add('hidden');
    } else {
        closedContainer.classList.add('hidden');
        formContainer.classList.remove('hidden');
        successContainer.classList.add('hidden');
        updateView();
    }



    // Validation logic
    function validateCurrentStep() {
        const currentStepDiv = steps[currentStepIndex];
        const inputs = currentStepDiv.querySelectorAll('input[required], select[required]');
        let isValid = true;

        inputs.forEach(input => {
            if (!input.checkValidity()) {
                input.reportValidity();
                isValid = false;
            }
        });

        // Custom check for radio buttons
        const radios = currentStepDiv.querySelectorAll('input[type="radio"]');
        if (radios.length > 0) {
            let oneChecked = false;
            radios.forEach(r => { if (r.checked) oneChecked = true; });
            if (!oneChecked) {
                radios[0].reportValidity();
                isValid = false;
            }
        }

        return isValid;
    }

    // Next Button Click
    btnNext.addEventListener('click', () => {
        if (validateCurrentStep()) {
            if (currentStepIndex < steps.length - 1) {
                currentStepIndex++;
                updateView();
            }
        }
    });

    // Prev Button Click
    btnPrev.addEventListener('click', () => {
        if (currentStepIndex > 0) {
            currentStepIndex--;
            updateView();
        }
    });

    // Handle Submit
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (currentStepIndex === steps.length - 1 && validateCurrentStep()) {

            // UI State change: Disable button & show uploading text
            const btnTextElement = currentLang === 'ar' ? 'إرسال' : 'Submit';
            const originalBtnText = btnSubmit.textContent;
            btnSubmit.textContent = (currentLang === 'ar') ? 'جاري الرفع...' : 'Uploading...';
            btnSubmit.disabled = true;
            btnSubmit.style.opacity = '0.7';
            btnSubmit.style.cursor = 'not-allowed';

            try {
                // Initialize supabase safely to prevent global JS blocking
                if (!supabase && window.supabase) {
                    supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
                }

                if (!supabase) throw new Error("Supabase is missing. Check your connection or Ad-Blocker!");

                // 1. Get form values mapping to exact expected database columns
                const name_ar = document.getElementById('fullNameAr').value;
                const name_en = document.getElementById('fullNameEn').value;
                const uni_id = document.getElementById('uniId').value;
                const birthdate = document.getElementById('birthDate').value;
                const major = majorSelectEl.value; // From standard select
                const gender = getCurrentGender();

                // File
                const cvFile = fileInput.files[0];
                if (!cvFile) throw new Error("CV file is required.");

                // 2. Upload to Supabase Storage 'cv_uploads' bucket
                // Ensure unique name using Date.now() + original safe name
                const safeFileName = cvFile.name.replace(/[^a-zA-Z0-9.\-_]/g, '_');
                const uniqueFileName = `${Date.now()}_${safeFileName}`;

                const { data: uploadData, error: uploadError } = await supabase.storage
                    .from('cv_uploads')
                    .upload(uniqueFileName, cvFile, {
                        cacheControl: '3600',
                        upsert: false
                    });

                if (uploadError) throw uploadError;

                // 3. Get Public URL of the uploaded CV
                const { data: publicUrlData } = supabase.storage
                    .from('cv_uploads')
                    .getPublicUrl(uniqueFileName);

                const cv_url = publicUrlData.publicUrl;

                // 4. Insert row into 'registrations' database table
                const { error: dbError } = await supabase
                    .from('registrations')
                    .insert([
                        {
                            name_ar: name_ar,
                            name_en: name_en,
                            uni_id: uni_id,
                            gender: gender,
                            birthdate: birthdate,
                            major: major,
                            cv_url: cv_url
                        }
                    ]);

                if (dbError) throw dbError;

                // 5. Completion: Show clean success UI, reset form
                formContainer.classList.add('hidden');
                successContainer.classList.remove('hidden');

                // Optional: completely reset the form underlying state
                form.reset();
                if (fp) fp.clear();
                if (majorChoices) updateChoices(null, currentLang); // Retrigger choices reset safely
                fileMsg.textContent = (currentLang === 'ar') ? 'اختر ملفاً أو اسحبه هنا' : 'Choose a file or drag it here';
                fileMsg.style.color = 'var(--text-main)';
                fileDropArea.style.borderColor = 'var(--border-color)';
                fileDropArea.style.backgroundColor = '#fafafa';

                // Reset step explicitly to 0 in case they return
                currentStepIndex = 0;

            } catch (error) {
                console.error("Registration Error:", error);

                // Show user friendly error modal fallback
                const errorMsg = currentLang === 'ar'
                    ? 'حدث خطأ أثناء التسجيل. يرجى المحاوله مرة أخرى.'
                    : 'An error occurred during registration. Please try again.';

                const devMsg = error.message || JSON.stringify(error);
                alert(`${errorMsg}\n\n[Dev Details: ${devMsg}]`);
            } finally {
                // Restore Button Original State
                btnSubmit.textContent = originalBtnText;
                btnSubmit.disabled = false;
                btnSubmit.style.opacity = '1';
                btnSubmit.style.cursor = 'pointer';
            }
        }
    });

    // File Upload visual feedback
    if (fileInput) {
        fileInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) {
                fileMsg.textContent = file.name;
                fileMsg.style.color = 'var(--brand-color)';
                fileDropArea.style.borderColor = 'var(--brand-color)';
                fileDropArea.style.backgroundColor = 'rgba(128, 0, 32, 0.03)';
            } else {
                fileMsg.textContent = (currentLang === 'ar') ? 'اختر ملفاً أو اسحبه هنا' : 'Choose a file or drag it here';
                fileMsg.style.color = 'var(--text-main)';
                fileDropArea.style.borderColor = 'var(--border-color)';
                fileDropArea.style.backgroundColor = '#fafafa';
            }
        });

        // Drag and drop styles
        ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
            fileDropArea.addEventListener(eventName, preventDefaults, false);
        });

        function preventDefaults(e) {
            e.preventDefault();
            e.stopPropagation();
        }

        ['dragenter', 'dragover'].forEach(eventName => {
            fileDropArea.addEventListener(eventName, () => {
                fileDropArea.classList.add('dragover');
            }, false);
        });

        ['dragleave', 'drop'].forEach(eventName => {
            fileDropArea.addEventListener(eventName, () => {
                fileDropArea.classList.remove('dragover');
            }, false);
        });

        fileDropArea.addEventListener('drop', (e) => {
            let dt = e.dataTransfer;
            let files = dt.files;

            if (files.length) {
                fileInput.files = files;
                const event = new Event('change');
                fileInput.dispatchEvent(event);
            }
        }, false);
    }

    // Handle Enter keypress for next step
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && isRegistrationOpen) {
            if (currentStepIndex < steps.length - 1) {
                e.preventDefault();
                btnNext.click();
            }
        }
    });
});
