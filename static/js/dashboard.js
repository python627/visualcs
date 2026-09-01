function getDashboardMasteryLevels(lesson) {

    return Array.isArray(lesson.mastery_levels)
        ? lesson.mastery_levels.filter(level => (
            level
            && typeof level.id === "string"
            && typeof level.label === "string"
        ))
        : [];

}


function getDashboardLevelProgress(progress, lessonId, levelId) {

    return progress.masteryByLesson?.[lessonId]?.levels?.[levelId]
        || { status: "locked", expert: {} };

}


function hasSolvedExpert(level, levelProgress) {

    return level.kind === "expert"
        && (
            levelProgress.status === "completed"
            || (levelProgress.expert?.solvedAttempts || 0) > 0
        );

}


function getDashboardLessonSummary(lesson, progress) {

    const levels = getDashboardMasteryLevels(lesson);
    const courseCompleted = progress.completedLessons.includes(lesson.id);
    const activity = progress.lessonActivityByLesson?.[lesson.id] || null;
    const trackedLevels = levels
        .map((level, index) => ({
            level,
            index,
            progress: getDashboardLevelProgress(progress, lesson.id, level.id)
        }));
    const expertEntry = trackedLevels.find(entry => entry.level.kind === "expert");
    const masteryEntry = trackedLevels.find(entry => entry.level.id === "mastery");
    const expertSolved = Boolean(
        expertEntry && hasSolvedExpert(expertEntry.level, expertEntry.progress)
    );
    const masteryComplete = Boolean(
        masteryEntry && masteryEntry.progress.status === "completed"
    );
    const reachedEntries = trackedLevels.filter(entry => (
        entry.progress.status === "completed"
        || entry.progress.status === "in_progress"
        || hasSolvedExpert(entry.level, entry.progress)
    ));
    const highestEntry = reachedEntries.at(-1) || null;
    const improving = Boolean(
        highestEntry
        && highestEntry.index > 0
        && !masteryComplete
        && !expertSolved
    );
    const inProgress = Boolean(
        activity
        || trackedLevels.some(entry => entry.progress.status === "in_progress")
    );
    const highestLevelText = highestEntry
        ? `Level ${highestEntry.index + 1} — ${highestEntry.level.label}`
        : (courseCompleted ? "Level 1 — Learn" : null);

    let state = "not_started";
    let label = "○ Not Started";

    if (expertSolved) {
        state = "expert";
        label = "🏆 Expert";
    }
    else if (inProgress && highestEntry?.progress.status === "in_progress") {
        state = "in_progress";
        label = "◐ In Progress";
    }
    else if (masteryComplete) {
        state = "mastered";
        label = "★ Mastered";
    }
    else if (improving) {
        state = "improving";
        label = "◐ Improving";
    }
    else if (courseCompleted) {
        state = "learned";
        label = "✓ Learned";
    }
    else if (inProgress) {
        state = "in_progress";
        label = "◐ In Progress";
    }

    return {
        courseCompleted,
        activity,
        expertSolved,
        masteryComplete,
        inProgress,
        hasPractice: levels.some(level => level.completion?.type !== "course_completion"),
        state,
        label,
        highestLevelText,
        masteryText: highestLevelText
            ? `Mastery: ${highestLevelText}`
            : "Mastery: Not started"
    };

}


function getDashboardAction(summary) {

    if (summary.state === "not_started") {
        return "Start Lesson →";
    }

    if (summary.inProgress) {
        return "Continue Lesson →";
    }

    if (summary.state === "learned") {
        return summary.hasPractice ? "Start Practice →" : "Review Lesson →";
    }

    if (summary.state === "improving") {
        return "Continue Mastery →";
    }

    return "Practice Again →";

}


function getLessonUrl(lesson) {

    return document.querySelector(
        `[data-lesson-card][data-lesson-id="${lesson.id}"] [data-lesson-action]`
    )?.href || "#";

}


function selectContinueLesson(lessons, progress) {

    const summaries = lessons.map(lesson => ({
        lesson,
        summary: getDashboardLessonSummary(lesson, progress)
    }));

    return summaries.find(item => item.summary.inProgress)
        || summaries.find(item => item.summary.state === "improving")
        || summaries.find(item => !item.summary.courseCompleted)
        || null;

}


function renderContinueLearning(lessons, progress) {

    const panel = document.getElementById("continue-learning");

    if (!panel) {
        return;
    }

    const choice = selectContinueLesson(lessons, progress);

    if (!choice) {
        panel.innerHTML = `
            <div class="continue-learning-copy">
                <span class="teaching-kicker">Learning journey</span>
                <h2>All lessons learned</h2>
                <p>Every beginner lesson is complete. Return to any lesson to practise or build mastery.</p>
            </div>
        `;
        return;
    }

    const { lesson, summary } = choice;
    const isResuming = summary.inProgress || summary.state === "improving";
    const detail = summary.highestLevelText
        ? `You're currently at ${summary.highestLevelText}.`
        : (isResuming
            ? "Continue the guided lesson where you left off."
            : "Begin with the guided learning path.");

    panel.innerHTML = `
        <div class="continue-learning-copy">
            <span class="teaching-kicker">${isResuming ? "Continue learning" : "Up next"}</span>
            <h2></h2>
            <p></p>
        </div>
        <a class="continue-learning-action" href="${getLessonUrl(lesson)}"></a>
    `;
    panel.querySelector("h2").textContent = lesson.title;
    panel.querySelector("p").textContent = detail;
    panel.querySelector(".continue-learning-action").textContent = isResuming
        ? "Continue Lesson →"
        : "Start Lesson →";

}


function renderLearningDashboard(lessons) {

    const progress = getProgress();
    const summaries = new Map(
        lessons.map(lesson => [
            lesson.id,
            getDashboardLessonSummary(lesson, progress)
        ])
    );
    const learnedCount = lessons.filter(
        lesson => summaries.get(lesson.id).courseCompleted
    ).length;
    const masteredCount = lessons.filter(
        lesson => summaries.get(lesson.id).masteryComplete
    ).length;
    const expertCount = lessons.filter(
        lesson => summaries.get(lesson.id).expertSolved
    ).length;
    const percentage = lessons.length
        ? Math.round((learnedCount / lessons.length) * 100)
        : 0;

    document.querySelectorAll("[data-lesson-card]").forEach(card => {
        const summary = summaries.get(card.dataset.lessonId);

        if (!summary) {
            return;
        }

        card.dataset.progressState = summary.state;
        card.classList.toggle("lesson-completed", summary.courseCompleted);
        card.classList.toggle("lesson-mastered", summary.masteryComplete);
        card.classList.toggle("lesson-expert", summary.expertSolved);

        const status = card.querySelector("[data-lesson-status]");
        const mastery = card.querySelector("[data-lesson-mastery]");
        const action = card.querySelector("[data-lesson-action]");

        if (status) status.textContent = summary.label;
        if (mastery) mastery.textContent = summary.masteryText;
        if (action) action.textContent = getDashboardAction(summary);
    });

    document.querySelectorAll("[data-subject-section]").forEach(section => {
        const ids = [...section.querySelectorAll("[data-lesson-card]")]
            .map(card => card.dataset.lessonId);
        const learned = ids.filter(id => summaries.get(id)?.courseCompleted).length;
        const label = section.querySelector("[data-subject-progress]");

        if (label) {
            label.textContent = `${learned} / ${ids.length} learned`;
        }
    });

    const overallText = document.getElementById("overall-progress-text");
    const progressBar = document.getElementById("overall-progress-bar");
    const mastered = document.getElementById("mastered-lessons-count");
    const expert = document.getElementById("expert-lessons-count");

    if (overallText) {
        overallText.textContent = `${learnedCount} / ${lessons.length} lessons learned · ${percentage}%`;
    }

    if (progressBar) {
        progressBar.style.width = `${percentage}%`;
        progressBar.parentElement?.setAttribute("aria-valuenow", percentage);
    }

    if (mastered) mastered.textContent = `Mastered: ${masteredCount}`;
    if (expert) expert.textContent = `Expert: ${expertCount}`;

    renderContinueLearning(lessons, progress);

}


function initializeLearningDashboard(lessons = []) {

    const catalog = Array.isArray(lessons) ? lessons : [];
    const render = () => renderLearningDashboard(catalog);

    render();

    const resetButton = document.getElementById("reset-progress");

    if (resetButton) {
        resetButton.addEventListener("click", () => {
            if (window.confirm("Reset all VisualCS lesson progress? This cannot be undone.")) {
                resetProgress();
            }
        });
    }

    window.addEventListener("visualcs-progress-changed", render);
    window.addEventListener("storage", event => {
        if (event.key === VISUALCS_PROGRESS_KEY) {
            render();
        }
    });

}
