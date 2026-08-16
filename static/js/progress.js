const VISUALCS_PROGRESS_KEY = "visualcs_progress";


function getProgress() {

    try {
        const storedProgress = localStorage.getItem(VISUALCS_PROGRESS_KEY);

        if (!storedProgress) {
            return { completedLessons: [] };
        }

        const parsedProgress = JSON.parse(storedProgress);
        const completedLessons = Array.isArray(parsedProgress.completedLessons)
            ? parsedProgress.completedLessons.filter(lessonId => typeof lessonId === "string")
            : [];

        return {
            completedLessons: [...new Set(completedLessons)]
        };
    }
    catch (error) {
        return { completedLessons: [] };
    }

}


function saveProgress(progress) {

    try {
        localStorage.setItem(
            VISUALCS_PROGRESS_KEY,
            JSON.stringify({
                completedLessons: [...new Set(progress.completedLessons)]
            })
        );
    }
    catch (error) {
        return;
    }

}


function markLessonCompleted(lessonId) {

    const progress = getProgress();

    if (!progress.completedLessons.includes(lessonId)) {
        progress.completedLessons.push(lessonId);
        saveProgress(progress);
    }

    window.dispatchEvent(new CustomEvent("visualcs-progress-changed"));

}


function resetProgress() {

    try {
        localStorage.removeItem(VISUALCS_PROGRESS_KEY);
    }
    catch (error) {
        return;
    }

    window.dispatchEvent(new CustomEvent("visualcs-progress-changed"));

}


function renderCatalogProgress() {

    const completedLessons = new Set(getProgress().completedLessons);
    const lessonCards = [...document.querySelectorAll("[data-lesson-id]")];
    const lessonIds = [...new Set(lessonCards.map(card => card.dataset.lessonId))];

    lessonCards.forEach(card => {
        const completed = completedLessons.has(card.dataset.lessonId);
        const badge = card.querySelector("[data-completion-badge]");

        card.classList.toggle("lesson-completed", completed);

        if (badge) {
            badge.hidden = !completed;
        }
    });

    document.querySelectorAll("[data-subject-section]").forEach(section => {
        const subjectLessonIds = [...new Set(
            [...section.querySelectorAll("[data-lesson-id]")]
                .map(card => card.dataset.lessonId)
        )];
        const completedCount = subjectLessonIds.filter(
            lessonId => completedLessons.has(lessonId)
        ).length;
        const subjectProgress = section.querySelector("[data-subject-progress]");

        if (subjectProgress) {
            subjectProgress.textContent = `${completedCount} / ${subjectLessonIds.length} completed`;
        }
    });

    const completedCount = lessonIds.filter(
        lessonId => completedLessons.has(lessonId)
    ).length;
    const percentage = lessonIds.length === 0
        ? 0
        : Math.round((completedCount / lessonIds.length) * 100);
    const overallText = document.getElementById("overall-progress-text");
    const progressBar = document.getElementById("overall-progress-bar");

    if (overallText) {
        overallText.textContent = `${completedCount} / ${lessonIds.length} lessons completed · ${percentage}%`;
    }

    if (progressBar) {
        progressBar.style.width = `${percentage}%`;
        progressBar.parentElement.setAttribute("aria-valuenow", percentage);
    }

}


function initializeCatalogProgress() {

    renderCatalogProgress();

    const resetButton = document.getElementById("reset-progress");

    if (resetButton) {
        resetButton.addEventListener("click", () => {
            const confirmed = window.confirm(
                "Reset all VisualCS lesson progress? This cannot be undone."
            );

            if (confirmed) {
                resetProgress();
            }
        });
    }

    window.addEventListener("visualcs-progress-changed", renderCatalogProgress);
    window.addEventListener("storage", event => {
        if (event.key === VISUALCS_PROGRESS_KEY) {
            renderCatalogProgress();
        }
    });

}
