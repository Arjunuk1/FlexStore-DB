const fs = require("fs");
const path = require("path");

class WALManager {
    constructor(dataDirectory) {
        fs.mkdirSync(dataDirectory, { recursive: true });
        this.filePath = path.join(dataDirectory, "wal.log");
    }

    append(entry) {
        fs.appendFileSync(
            this.filePath,
            `${JSON.stringify({ timestamp: Date.now(), ...entry })}\n`,
            "utf8"
        );
    }

    readAll() {
        if (!fs.existsSync(this.filePath)) {
            return [];
        }

        return fs.readFileSync(this.filePath, "utf8")
            .split("\n")
            .filter(line => line.trim())
            .flatMap(line => {
                try {
                    return [JSON.parse(line)];
                } catch {
                    return [];
                }
            });
    }

    clear() {
        fs.writeFileSync(this.filePath, "", "utf8");
    }
}

module.exports = WALManager;