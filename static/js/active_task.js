/* Shared surface for the learner's immediate action. */
(function registerActiveTask() {
    function escapeHTML(value) {
        return String(value ?? "")
            .replaceAll("&", "&amp;")
            .replaceAll("<", "&lt;")
            .replaceAll(">", "&gt;")
            .replaceAll('"', "&quot;")
            .replaceAll("'", "&#039;");
    }

    window.activeTask = {
        render({ label = "YOUR TASK", step = null, total = null, title = "", instruction = "", meta = [] } = {}) {
            const host = document.getElementById("active-task");
            if (!host) return;

            const progress = Number.isInteger(step) && Number.isInteger(total)
                ? ` · STEP ${step} OF ${total}`
                : "";
            const facts = Array.isArray(meta)
                ? meta.filter(Boolean).map(item => `<span>${escapeHTML(item)}</span>`).join("")
                : "";

            host.hidden = false;
            host.innerHTML = `
                <div class="active-task-card">
                    <span class="active-task-label">${escapeHTML(label)}${progress}</span>
                    ${title ? `<strong class="active-task-title">${escapeHTML(title)}</strong>` : ""}
                    ${instruction ? `<p class="active-task-instruction">${escapeHTML(instruction)}</p>` : ""}
                    ${facts ? `<div class="active-task-meta">${facts}</div>` : ""}
                </div>
            `;
        },

        clear() {
            const host = document.getElementById("active-task");
            if (!host) return;
            host.hidden = true;
            host.innerHTML = "";
        }
    };
})();
