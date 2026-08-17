let selectedPrediction = null;
let predictionPromptVisible = false;


function getGuidedTeaching() {

    return LESSON.guided_teaching || null;

}


function formatGuidedText(template, values = {}) {

    return Object.entries(values).reduce(
        (text, [key, value]) => text.replaceAll(`{${key}}`, value),
        template
    );

}


function getGuidedValue(index, fallback) {

    const values = getGuidedTeaching()?.values;

    return Array.isArray(values) && index < values.length
        ? values[index]
        : fallback;

}


function getGuidedActionExplanation(operation, index, values) {

    const explanations = getGuidedTeaching()?.action_explanations?.[operation];
    const explanation = Array.isArray(explanations)
        ? explanations[index]
        : explanations;

    return typeof explanation === "string"
        ? formatGuidedText(explanation, values)
        : null;

}


function showGuidedActionExplanation(operation, index, values) {

    const explanation = getGuidedActionExplanation(operation, index, values);

    if (explanation) {
        setByteMessage(explanation);
    }

}


function getPredictionConfig() {

    return getGuidedTeaching()?.prediction || null;

}


function getPredictionPanel() {

    return document.getElementById("prediction-panel");

}


function showPredictionPrompt() {

    const prediction = getPredictionConfig();
    const panel = getPredictionPanel();

    if (!prediction || !panel || selectedPrediction !== null) {
        return;
    }

    predictionPromptVisible = true;

    panel.hidden = false;
    panel.innerHTML = `
        <div class="prediction-card">
            <h3>${prediction.heading}</h3>
            <p>${prediction.question}</p>
            <div class="prediction-choices">
                ${prediction.choices.map((choice, index) => `
                    <button class="prediction-choice" data-prediction-index="${index}">
                        ${choice}
                    </button>
                `).join("")}
            </div>
        </div>
    `;

    panel.querySelectorAll("[data-prediction-index]").forEach(button => {
        button.addEventListener("click", () => {
            selectPrediction(
                prediction.choices[Number(button.dataset.predictionIndex)]
            );
        });
    });

}


function selectPrediction(prediction) {

    const config = getPredictionConfig();
    const panel = getPredictionPanel();

    if (!config || !panel || selectedPrediction !== null) {
        return;
    }

    selectedPrediction = prediction;

    panel.innerHTML = `
        <div class="prediction-card">
            <h3>${config.heading}</h3>
            <p class="prediction-selected">
                ${formatGuidedText(config.selection_message, { prediction })}
            </p>
        </div>
    `;

}


function isGuidedPredictionPending() {

    return predictionPromptVisible && selectedPrediction === null;

}


function isGuidedPredictionRequired(operation) {

    const prediction = getPredictionConfig();

    return prediction?.before_operation === operation
        && getExpectedOperation() === operation
        && selectedPrediction === null;

}


function resolveGuidedPrediction(actual, operation) {

    const prediction = getPredictionConfig();
    const panel = getPredictionPanel();

    if (!prediction || !panel || selectedPrediction === null) {
        return;
    }

    const result = prediction.result;
    const isCorrect = String(selectedPrediction) === String(actual);
    const predictionMessage = formatGuidedText(
        isCorrect ? result.correct : result.incorrect,
        { prediction: selectedPrediction }
    );
    const actualTemplate = isCorrect && result.correct_actual
        ? result.correct_actual
        : result.actual;
    const actualMessage = formatGuidedText(actualTemplate, { actual });
    const resultOperation = operation || prediction.result_operation
        || prediction.before_operation;
    const explanation = getGuidedActionExplanation(
        resultOperation,
        0,
        { removed: actual }
    );

    panel.hidden = false;
    panel.innerHTML = `
        <div class="prediction-card prediction-result">
            <p>${predictionMessage}</p>
            <p class="prediction-actual">${actualMessage}</p>
            ${explanation ? `<p>${explanation}</p>` : ""}
            <div class="operation-connection">
                <span>${result.concept.last_in}</span>
                <span>${result.concept.arrow}</span>
                <span>${result.concept.first_out}</span>
                <strong>${result.concept.label}</strong>
            </div>
        </div>
    `;

}


function resetGuidedTeaching() {

    selectedPrediction = null;
    predictionPromptVisible = false;

    const panel = getPredictionPanel();

    if (panel) {
        panel.hidden = true;
        panel.innerHTML = "";
    }

}
