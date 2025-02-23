function getTimestamp() {
    return new Date().toISOString().replace('T', ' ').substr(0, 19);
}

class Logger {
    static startSection(name) {
        console.log(`[${getTimestamp()}] === Début : ${name} ===`);
    }

    static endSection(name) {
        console.log(`[${getTimestamp()}] === Fin : ${name} ===`);
    }

    static info(message) {
        console.log(`[${getTimestamp()}] INFO: ${message}`);
    }

    static success(message) {
        console.log(`[${getTimestamp()}] ✓ ${message}`);
    }

    static warn(message) {
        console.log(`[${getTimestamp()}] ⚠️ ${message}`);
    }

    static error(message, error) {
        console.error(`[${getTimestamp()}] ❌ ${message}`);
        if (error?.response?.data) {
            console.error('Détails:', error.response.data);
        } else if (error) {
            console.error('Erreur:', error.message || error);
        }
    }

    static debug(data, message = '') {
        console.log(`[${getTimestamp()}] DEBUG: ${message}`, data);
    }

    static api = {
        request: (endpoint, data) => {
            console.log(`[${getTimestamp()}] → API ${endpoint}`, data);
        },
        response: (data, stats) => {
            console.log(`[${getTimestamp()}] ← API Response`);
            if (stats) {
                console.log(`   Tokens: ${stats.input} → ${stats.output} (${stats.ratio}%)`);
            }
            console.log('   Data:', data);
        }
    };
}

module.exports = Logger;
