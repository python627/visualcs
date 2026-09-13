/* Explicit relational data structures shared by table-oriented lessons. */
const RelationalModel = (() => {
    const supportedTypes = new Set(["string", "number", "boolean"]);
    const clone = value => JSON.parse(JSON.stringify(value));

    function fail(message) {
        const error = new Error(message);
        error.name = "RelationalModelError";
        throw error;
    }

    function isIdentifier(value) {
        return typeof value === "string" && /^[A-Za-z_][A-Za-z0-9_-]*$/.test(value);
    }

    function valueMatchesType(value, type) {
        if (type === "number") return typeof value === "number" && Number.isFinite(value);
        if (type === "boolean") return typeof value === "boolean";
        return typeof value === "string";
    }

    function validateTable(table) {
        if (!table || !isIdentifier(table.name)) fail("Every table needs an explicit name.");
        if (!Array.isArray(table.columns) || !table.columns.length) {
            fail(`Table "${table.name}" needs explicit columns.`);
        }

        const columnNames = new Set();
        table.columns.forEach(column => {
            if (!column || !isIdentifier(column.name) || !supportedTypes.has(column.type)) {
                fail(`Table "${table.name}" contains an invalid column definition.`);
            }
            if (columnNames.has(column.name)) fail(`Table "${table.name}" repeats column "${column.name}".`);
            columnNames.add(column.name);
        });

        if (!Array.isArray(table.rows)) fail(`Table "${table.name}" needs a rows array.`);
        const rowIds = new Set();
        table.rows.forEach(row => {
            if (!row || !isIdentifier(row.id) || !row.values || typeof row.values !== "object" || Array.isArray(row.values)) {
                fail(`Table "${table.name}" contains an invalid row.`);
            }
            if (rowIds.has(row.id)) fail(`Table "${table.name}" repeats row id "${row.id}".`);
            rowIds.add(row.id);

            const unknown = Object.keys(row.values).filter(name => !columnNames.has(name));
            if (unknown.length) fail(`Row "${row.id}" contains unknown column "${unknown[0]}".`);
            table.columns.forEach(column => {
                if (!Object.hasOwn(row.values, column.name)) {
                    fail(`Row "${row.id}" is missing column "${column.name}".`);
                }
                if (!valueMatchesType(row.values[column.name], column.type)) {
                    fail(`Row "${row.id}" value for "${column.name}" must be ${column.type}.`);
                }
            });
        });
        return table;
    }

    function validateDatabase(database) {
        if (!database || !Array.isArray(database.tables) || !database.tables.length) {
            fail("A relational database needs an explicit tables array.");
        }
        const names = new Set();
        database.tables.forEach(table => {
            validateTable(table);
            if (names.has(table.name)) fail(`Database repeats table "${table.name}".`);
            names.add(table.name);
        });
        return database;
    }

    function createDatabase(definition) {
        const database = clone(definition);
        validateDatabase(database);
        return database;
    }

    function getTable(database, name) {
        validateDatabase(database);
        const table = database.tables.find(candidate => candidate.name === name);
        if (!table) fail(`Unknown table "${name}".`);
        return table;
    }

    function getColumn(table, name) {
        validateTable(table);
        const column = table.columns.find(candidate => candidate.name === name);
        if (!column) fail(`Unknown field "${name}" in table "${table.name}".`);
        return column;
    }

    function rowValues(table, row, columns = table.columns.map(column => column.name)) {
        return columns.map(name => row.values[getColumn(table, name).name]);
    }

    return {
        createDatabase,
        validateDatabase,
        validateTable,
        getTable,
        getColumn,
        rowValues,
        clone,
        supportedTypes: Object.freeze([...supportedTypes])
    };
})();
