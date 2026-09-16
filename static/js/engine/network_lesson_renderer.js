/* Presentation helpers shared by executable networking lessons. */
const NetworkLessonRenderer = (() => {
    const escape = value => String(value ?? "").replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");

    function devices(items, { highlightedId = null } = {}) {
        return `<section class="network-device-grid">${items.map(item => `<article class="network-device ${item.id === highlightedId ? "active" : ""}">
            <span>${escape(item.role || "ENDPOINT")}</span><strong>${escape(item.name)}</strong><code>${escape(item.address || "address hidden")}</code>
        </article>`).join("")}</section>`;
    }

    function flow(items, activeIndex = -1) {
        return `<section class="network-flow" aria-label="Network flow">${items.map((item, index) => `${index ? '<span class="network-flow-arrow" aria-hidden="true">→</span>' : ""}
            <article class="network-flow-node ${index === activeIndex ? "active" : ""}"><span>${escape(item.label || item)}</span>${item.detail ? `<small>${escape(item.detail)}</small>` : ""}</article>`).join("")}</section>`;
    }

    function timeline(items, visibleCount = items.length) {
        return `<ol class="network-event-timeline">${items.slice(0, visibleCount).map((item, index) => `<li class="${index === visibleCount - 1 ? "active" : ""}">
            <span>${index + 1}</span><strong>${escape(item.label || item)}</strong>${item.detail ? `<small>${escape(item.detail)}</small>` : ""}</li>`).join("")}</ol>`;
    }

    function fields(assessment) {
        if (!assessment?.fields?.length) return "";
        return `<ul class="network-field-results">${assessment.fields.map(field => `<li class="${field.correct ? "correct" : "incorrect"}">
            ${field.correct ? "✓" : "Needs revision"} · ${escape(field.label)} — yours: ${escape(field.submitted)}; result: ${escape(field.expected)}</li>`).join("")}</ul>`;
    }

    return { escape, devices, flow, timeline, fields };
})();
