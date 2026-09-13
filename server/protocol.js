function encodeMessage(message) {
    return `${JSON.stringify(message)}\n`;
}

function decodeMessage(message) {
    if (typeof message !== "string" || !message.trim()) {
        throw new Error("Request must be a JSON object");
    }

    const value = JSON.parse(message);
    if (!value || typeof value !== "object" || Array.isArray(value)) {
        throw new Error("Request must be a JSON object");
    }

    return value;
}

module.exports = { encodeMessage, decodeMessage };