let alternateExplanationIndex = 0;


function showNextAlternateExplanation() {

    const explanations = LESSON.alternate_explanations || [];
    const button = document.getElementById("explain-differently");
    const container = document.getElementById("alternate-explanation");

    if (!button || !container || alternateExplanationIndex >= explanations.length) {
        return;
    }

    const explanation = explanations[alternateExplanationIndex];

    container.innerHTML = `
        <div class="alternate-explanation-card">
            <span class="alternate-explanation-type">${explanation.type}</span>
            <h3>${explanation.title}</h3>
            <p>${explanation.content}</p>
        </div>
    `;

    alternateExplanationIndex++;

    if (alternateExplanationIndex === explanations.length) {
        button.disabled = true;
        button.textContent = "All explanations shown";
    }

}


function initializeAlternateExplanations() {

    const button = document.getElementById("explain-differently");

    if (button) {
        button.addEventListener("click", showNextAlternateExplanation);
    }

}


initializeAlternateExplanations();
