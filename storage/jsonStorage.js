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
        fs.writeFileSync(
            this.filePath,
            JSON.stringify(data, null, 2),
            "utf8"
        );
    }
}

module.exports = JsonStorage;
