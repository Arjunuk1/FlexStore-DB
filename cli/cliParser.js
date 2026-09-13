function splitFirst(value) {
    const index = value.indexOf(" ");
    return index === -1
        ? [value.trim(), ""]
        : [value.slice(0, index), value.slice(index + 1).trim()];
}

function parseJson(value, usage) {
    if (!value) throw new Error(`Usage: ${usage}`);
    try {
        return JSON.parse(value);
    } catch {
        throw new Error(`Invalid JSON. Usage: ${usage}`);
    }
}

function parseCommand(input) {
    const trimmed = input.trim();
    if (!trimmed) return null;
    const [word, args] = splitFirst(trimmed);
    const command = word.toUpperCase();

    switch (command) {
        case "PING": case "HELP": case "INFO": case "STATUS":
        case "BEGIN": case "COMMIT": case "ROLLBACK": case "SHOW_WAL":
            if (args) throw new Error(`${command} does not accept arguments`);
            return { command };
        case "EXIT": case "QUIT": return { command: "EXIT" };
        case "USE": case "CREATE_DATABASE": case "DROP_DATABASE":
            if (!args || args.includes(" ")) throw new Error(`Usage: ${command} <name>`);
            return { command, name: args };
        case "SHOW":
            if (args.toUpperCase() === "DATABASES") return { command: "SHOW_DATABASES" };
            if (args.toUpperCase() === "COLLECTIONS") return { command: "SHOW_COLLECTIONS" };
            throw new Error("Usage: SHOW DATABASES | SHOW COLLECTIONS");
        case "CREATE": case "DROP": {
            const [kind, remainder] = splitFirst(args);
            if (kind.toUpperCase() === "DATABASE") {
                if (!remainder || remainder.includes(" ")) {
                    throw new Error(`${command} DATABASE <name>`);
                }
                return { command: `${command}_DATABASE`, name: remainder };
            }
            if (kind.toUpperCase() === "INDEX") {
                const [collection, field] = splitFirst(remainder);
                if (!collection || !field || field.includes(" ")) throw new Error("Usage: CREATE INDEX <collection> <field>");
                return { command: `${command}_INDEX`, collection, field };
            }
            const name = remainder;
            if (kind.toUpperCase() !== "COLLECTION" || !name || name.includes(" ")) {
                throw new Error("Usage: CREATE DATABASE <name> | CREATE COLLECTION <name> | DROP COLLECTION <name>");
            }
            return { command: `${command}_COLLECTION`, collection: name };
        }
        case "INSERT": {
            const [collection, json] = splitFirst(args);
            return { command, collection, document: parseJson(json, "INSERT <collection> <json>") };
        }
        case "FIND": case "COUNT": case "EXPLAIN": {
            const [collection, json] = splitFirst(args);
            return { command, collection, query: json ? parseJson(json, `${command} <collection> <json>`) : {} };
        }
        case "UPDATE": {
            const [collection, remainder] = splitFirst(args);
            const [id, json] = splitFirst(remainder);
            return { command, collection, id: parseId(id), update: parseJson(json, "UPDATE <collection> <id> <json>") };
        }
        case "DELETE": {
            const [collection, id] = splitFirst(args);
            if (!collection || !id || id.includes(" ")) throw new Error("Usage: DELETE <collection> <id>");
            return { command, collection, id: parseId(id) };
        }
        default: throw new Error(`Unknown CLI command: ${word}`);
    }
}

function parseId(value) {
    if (!value) throw new Error("A document id is required");
    const number = Number(value);
    return Number.isNaN(number) ? value : number;
}

module.exports = { parseCommand };