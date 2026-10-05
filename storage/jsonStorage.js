const fs = require("fs");
const path = require("path");

class JsonStorage {
    constructor(filePath) {
        this.filePath = path.resolve(filePath);
    }

    read() {
        if (!fs.existsSync(this.filePath)) {
            return [];
        }

        const content = fs.readFileSync(this.filePath, "utf8");

        if (!content.trim()) {
            return [];
        }

        return JSON.parse(content);
    }

    write(data) {
        const temporaryPath = `${this.filePath}.tmp-${process.pid}`;
        fs.mkdirSync(path.dirname(this.filePath), { recursive: true });

        try {
            const descriptor = fs.openSync(temporaryPath, "w");
            try {
                fs.writeFileSync(descriptor, JSON.stringify(data, null, 2), "utf8");
                fs.fsyncSync(descriptor);
            } finally {
                fs.closeSync(descriptor);
            }
            fs.renameSync(temporaryPath, this.filePath);
        } finally {
            if (fs.existsSync(temporaryPath)) fs.rmSync(temporaryPath, { force: true });
        }
    }
}

module.exports = JsonStorage;
