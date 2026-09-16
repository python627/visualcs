/* Shared, presentation-only table renderer for executable DBMS lessons. */
const RelationalTableRenderer = (() => {
    const escape = value => String(value ?? "").replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");

    function table(table, options = {}) {
        RelationalModel.validateTable(table);
        const highlightedRows = new Set(options.highlightedRows || []);
        const highlightedColumns = new Set(options.highlightedColumns || []);
        const highlightedCells = new Set(options.highlightedCells || []);
        const showTypes = options.showTypes !== false;
        return `<div class="relational-table-shell"><table class="relational-table">
            <caption>${escape(options.caption || table.name)}</caption>
            <thead><tr><th scope="col">Row ID</th>${table.columns.map(column => (
                `<th scope="col" class="${highlightedColumns.has(column.name) ? "is-highlighted" : ""}">
                    ${escape(column.name)}${showTypes ? `<small>${escape(column.type)}</small>` : ""}
                </th>`
            )).join("")}</tr></thead>
            <tbody>${table.rows.length ? table.rows.map(row => (
                `<tr data-row-id="${escape(row.id)}" class="${highlightedRows.has(row.id) ? "is-highlighted" : ""}">
                    <th scope="row">${escape(row.id)}</th>${table.columns.map(column => {
                        const key = `${row.id}:${column.name}`;
                        return `<td class="${highlightedCells.has(key) ? "is-highlighted" : ""}">${escape(row.values[column.name])}</td>`;
                    }).join("")}
                </tr>`
            )).join("") : `<tr><td colspan="${table.columns.length + 1}">No records</td></tr>`}</tbody>
        </table></div>`;
    }

    function database(database, options = {}) {
        RelationalModel.validateDatabase(database);
        return `<div class="relational-database">${database.tables.map(item => table(item, {
            ...(options[item.name] || {}), caption: options[item.name]?.caption || item.name
        })).join("")}</div>`;
    }

    function result(columns, rows, caption = "RESULT") {
        const names = columns.map(column => typeof column === "string" ? column : column.name);
        return `<div class="relational-table-shell"><table class="relational-table relational-result-table">
            <caption>${escape(caption)}</caption>
            <thead><tr><th scope="col">Result ID</th>${names.map(name => `<th scope="col">${escape(name)}</th>`).join("")}</tr></thead>
            <tbody>${rows.length ? rows.map((row, index) => `<tr><th scope="row">${escape(row.id || `result-${index + 1}`)}</th>${names.map(name => `<td>${escape(row.values[name] == null ? "NULL" : row.values[name])}</td>`).join("")}</tr>`).join("")
                : `<tr><td colspan="${names.length + 1}">0 rows</td></tr>`}</tbody>
        </table></div>`;
    }

    return { table, database, result, escape };
})();
