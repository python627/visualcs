const VISUALCS_PROGRESS_KEY = "visualcs_progress";
const VISUALCS_PROGRESS_SCHEMA_VERSION = 3;


function createEmptyProgress() {

    return {
        schemaVersion: VISUALCS_PROGRESS_SCHEMA_VERSION,
        completedLessons: [],
        masteryByLesson: {}
    };

}


function normalizeExpertScenario(scenario) {

    if (!scenario || typeof scenario !== "object") {
        return null;
    }

    if (
        typeof scenario.id !== "string"
        || typeof scenario.generator !== "string"
        || !Number.isInteger(scenario.generatorVersion)
        || !Number.isInteger(scenario.seed)
        || typeof scenario.fingerprint !== "string"
        || !scenario.data
        || typeof scenario.data !== "object"
    ) {
        return null;
    }

    return {
        id: scenario.id,
        generator: scenario.generator,
        generatorVersion: scenario.generatorVersion,
        seed: scenario.seed,
        fingerprint: scenario.fingerprint,
        data: scenario.data
    };

}


function normalizeExpertProgress(expert) {

    const source = expert && typeof expert === "object" ? expert : {};
    const positiveInteger = value => (
        Number.isInteger(value) && value >= 0 ? value : 0
    );
    const bestOperationCount = Number.isInteger(source.bestOperationCount)
        && source.bestOperationCount >= 0
        ? source.bestOperationCount
        : null;
    const predictionAccuracy = source.predictionAccuracy
        && typeof source.predictionAccuracy === "object"
        ? source.predictionAccuracy
        : {};
    const recentResults = Array.isArray(source.recentResults)
        ? source.recentResults
            .filter(result => result && typeof result === "object")
            .slice(-5)
            .map(result => ({
                status: typeof result.status === "string" ? result.status : "unknown",
                seed: Number.isInteger(result.seed) ? result.seed : null,
                operations: Number.isInteger(result.operations) ? result.operations : 0,
                optimalOperations: Number.isInteger(result.optimalOperations)
                    ? result.optimalOperations
                    : null,
                prediction: result.prediction && typeof result.prediction === "object"
                    ? {
                        correctFinalState: Boolean(result.prediction.correctFinalState),
                        correctNextPop: Boolean(result.prediction.correctNextPop)
                    }
                    : null
            }))
        : [];

    return {
        attempts: positiveInteger(source.attempts),
        solvedAttempts: positiveInteger(source.solvedAttempts),
        optimalAttempts: positiveInteger(source.optimalAttempts),
        bestOperationCount,
        predictionAccuracy: {
            submissions: positiveInteger(predictionAccuracy.submissions),
            correctFinalStates: positiveInteger(predictionAccuracy.correctFinalStates),
            correctNextPops: positiveInteger(predictionAccuracy.correctNextPops)
        },
        latestScenario: normalizeExpertScenario(source.latestScenario),
        recentResults
    };

}


function normalizeLevelProgress(level) {

    const validStatuses = new Set([
        "locked",
        "unlocked",
        "in_progress",
        "completed"
    ]);
    const source = level && typeof level === "object" ? level : {};
    const attempts = Number.isInteger(source.attempts) && source.attempts >= 0
        ? source.attempts
        : 0;
    const successfulAttempts = Number.isInteger(source.successfulAttempts)
        && source.successfulAttempts >= 0
        ? source.successfulAttempts
        : 0;

    return {
        status: validStatuses.has(source.status) ? source.status : "locked",
        attempts,
        successfulAttempts,
        hintsUsed: Number.isInteger(source.hintsUsed) && source.hintsUsed >= 0
            ? source.hintsUsed
            : 0,
        bestPerformance: source.bestPerformance
            && typeof source.bestPerformance === "object"
            ? source.bestPerformance
            : null,
        lastAttempt: source.lastAttempt
            && typeof source.lastAttempt === "object"
            ? source.lastAttempt
            : null,
        expert: normalizeExpertProgress(source.expert)
    };

}


function normalizeMasteryByLesson(masteryByLesson) {

    if (!masteryByLesson || typeof masteryByLesson !== "object") {
        return {};
    }

    return Object.fromEntries(
        Object.entries(masteryByLesson)
            .filter(([lessonId, lessonMastery]) => (
                typeof lessonId === "string"
                && lessonMastery
                && typeof lessonMastery === "object"
            ))
            .map(([lessonId, lessonMastery]) => {
                const levels = lessonMastery.levels
                    && typeof lessonMastery.levels === "object"
                    ? lessonMastery.levels
                    : {};

                return [
                    lessonId,
                    {
                        levels: Object.fromEntries(
                            Object.entries(levels)
                                .filter(([levelId]) => typeof levelId === "string")
                                .map(([levelId, level]) => [
                                    levelId,
                                    normalizeLevelProgress(level)
                                ])
                        )
                    }
                ];
            })
    );

}


function normalizeProgress(progress) {

    const source = progress && typeof progress === "object"
        ? progress
        : {};
    const completedLessons = Array.isArray(source.completedLessons)
        ? source.completedLessons.filter(lessonId => typeof lessonId === "string")
        : [];

    return {
        schemaVersion: VISUALCS_PROGRESS_SCHEMA_VERSION,
        completedLessons: [...new Set(completedLessons)],
        masteryByLesson: normalizeMasteryByLesson(source.masteryByLesson)
    };

}


function getProgress() {

    try {
        const storedProgress = localStorage.getItem(VISUALCS_PROGRESS_KEY);

        if (!storedProgress) {
            return createEmptyProgress();
        }

        const normalizedProgress = normalizeProgress(JSON.parse(storedProgress));

        // Existing users may have the original completedLessons-only format.
        // Re-saving the normalized object migrates it without losing completion.
        if (JSON.stringify(JSON.parse(storedProgress)) !== JSON.stringify(normalizedProgress)) {
            saveProgress(normalizedProgress);
        }

        return normalizedProgress;
    }
    catch (error) {
        return createEmptyProgress();
    }

}


function saveProgress(progress) {

    try {
        localStorage.setItem(
            VISUALCS_PROGRESS_KEY,
            JSON.stringify(normalizeProgress(progress))
        );
    }
    catch (error) {
        return;
    }

}


function getMasteryLevelProgress(lessonId, levelId) {

    const progress = getProgress();

    return progress.masteryByLesson[lessonId]?.levels?.[levelId]
        ?? normalizeLevelProgress();

}


function updateMasteryLevelProgress(lessonId, levelId, updater) {

    const progress = getProgress();
    const lessonMastery = progress.masteryByLesson[lessonId] || { levels: {} };
    const current = normalizeLevelProgress(lessonMastery.levels[levelId]);
    const next = normalizeLevelProgress(updater({ ...current }));

    progress.masteryByLesson[lessonId] = {
        levels: {
            ...lessonMastery.levels,
            [levelId]: next
        }
    };

    saveProgress(progress);
    window.dispatchEvent(new CustomEvent("visualcs-progress-changed"));

    return next;

}


function unlockMasteryLevel(lessonId, levelId) {

    return updateMasteryLevelProgress(lessonId, levelId, current => ({
        ...current,
        status: current.status === "completed" ? "completed" : "unlocked"
    }));

}


function startMasteryAttempt(lessonId, levelId) {

    return updateMasteryLevelProgress(lessonId, levelId, current => ({
        ...current,
        status: "in_progress",
        attempts: current.attempts + 1,
        lastAttempt: {
            status: "in_progress",
            operations: 0,
            hintsUsed: 0
        }
    }));

}


function getExpertProgress(lessonId, levelId) {

    return getMasteryLevelProgress(lessonId, levelId).expert;

}


function startExpertAttempt(lessonId, levelId, scenario) {

    const latestScenario = normalizeExpertScenario(scenario);

    return updateMasteryLevelProgress(lessonId, levelId, current => ({
        ...current,
        status: "in_progress",
        attempts: current.attempts + 1,
        lastAttempt: {
            status: "in_progress",
            operations: 0,
            hintsUsed: 0
        },
        expert: {
            ...current.expert,
            attempts: current.expert.attempts + 1,
            latestScenario
        }
    }));

}


function finishExpertAttempt(lessonId, levelId, result) {

    return updateMasteryLevelProgress(lessonId, levelId, current => {
        const solved = Boolean(result.solved);
        const perfect = Boolean(result.perfect);
        const operations = Number.isInteger(result.operations) ? result.operations : 0;
        const prediction = result.prediction?.assessment || {};
        const bestOperationCount = solved && (
            current.expert.bestOperationCount === null
            || operations < current.expert.bestOperationCount
        )
            ? operations
            : current.expert.bestOperationCount;
        const recentResult = {
            status: perfect ? "perfect" : (solved ? "solved" : "failed"),
            seed: result.scenario?.seed ?? null,
            operations,
            optimalOperations: result.optimalOperations ?? null,
            prediction: {
                correctFinalState: Boolean(prediction.correctFinalState),
                correctNextPop: Boolean(prediction.correctNextPop)
            }
        };
        const expert = {
            ...current.expert,
            solvedAttempts: current.expert.solvedAttempts + (solved ? 1 : 0),
            optimalAttempts: current.expert.optimalAttempts + (perfect ? 1 : 0),
            bestOperationCount,
            predictionAccuracy: {
                submissions: current.expert.predictionAccuracy.submissions + 1,
                correctFinalStates: current.expert.predictionAccuracy.correctFinalStates
                    + (prediction.correctFinalState ? 1 : 0),
                correctNextPops: current.expert.predictionAccuracy.correctNextPops
                    + (prediction.correctNextPop ? 1 : 0)
            },
            latestScenario: normalizeExpertScenario(result.scenario)
                || current.expert.latestScenario,
            recentResults: [...current.expert.recentResults, recentResult].slice(-5)
        };
        const performance = {
            operations,
            hintsUsed: 0,
            operationCounts: result.operationCounts || {}
        };

        return {
            ...current,
            status: perfect ? "completed" : "unlocked",
            successfulAttempts: current.successfulAttempts + (solved ? 1 : 0),
            bestPerformance: solved && (
                !current.bestPerformance
                || operations < current.bestPerformance.operations
            )
                ? performance
                : current.bestPerformance,
            lastAttempt: {
                status: perfect ? "completed" : (solved ? "solved" : "failed"),
                ...performance
            },
            expert
        };
    });

}


function finishMasteryAttempt(lessonId, levelId, result) {

    return updateMasteryLevelProgress(lessonId, levelId, current => {
        const performance = {
            operations: result.operations,
            hintsUsed: result.hintsUsed,
            operationCounts: result.operationCounts || {}
        };
        const successful = result.status === "completed";
        const bestPerformance = successful && (
            !current.bestPerformance
            || performance.operations < current.bestPerformance.operations
            || (
                performance.operations === current.bestPerformance.operations
                && performance.hintsUsed < current.bestPerformance.hintsUsed
            )
        )
            ? performance
            : current.bestPerformance;

        return {
            ...current,
            status: successful ? "completed" : "unlocked",
            successfulAttempts: current.successfulAttempts + (successful ? 1 : 0),
            hintsUsed: current.hintsUsed + performance.hintsUsed,
            bestPerformance,
            lastAttempt: {
                status: result.status,
                ...performance
            }
        };
    });

}


function markMasteryLevelCompleted(lessonId, levelId, performance = {}) {

    return updateMasteryLevelProgress(lessonId, levelId, current => ({
        ...current,
        status: "completed",
        successfulAttempts: Math.max(1, current.successfulAttempts),
        bestPerformance: current.bestPerformance || {
            operations: performance.operations ?? 0,
            hintsUsed: performance.hintsUsed ?? 0,
            operationCounts: performance.operationCounts || {}
        },
        lastAttempt: current.lastAttempt || {
            status: "completed",
            operations: performance.operations ?? 0,
            hintsUsed: performance.hintsUsed ?? 0,
            operationCounts: performance.operationCounts || {}
        }
    }));

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
