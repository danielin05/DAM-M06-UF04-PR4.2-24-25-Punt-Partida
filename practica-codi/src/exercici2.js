// Importacions
const csv = require('csv-parser');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: '../.env' }); // Ajusta la ruta si és necessari

// Constants
const DATA_SUBFOLDER = 'steamreviews';
const CSV_GAMES_FILE_NAME = 'games.csv';
const CSV_REVIEWS_FILE_NAME = 'reviews.csv';
const SENTIMENT_POSITIVE = 'positive';
const SENTIMENT_NEGATIVE = 'negative';
const SENTIMENT_NEUTRAL = 'neutral';
const SENTIMENT_ERROR = 'error';

// Funció per llegir el CSV de forma asíncrona usant for await...of
async function readCSV(filePath) {
    const results = [];
    try {
        for await (const record of fs.createReadStream(filePath).pipe(csv())) {
            results.push(record);
        }
    } catch (error) {
        console.error('Error llegint el fitxer CSV:', error);
        throw error; // Important: Re-llancem l'error per a que sigui capturat pel main()
    }
    return results;
}

// Funció per fer la petició a Ollama amb més detalls d'error
async function analyzeSentiment(text) {
    try {
        console.log('Enviant petició a Ollama...');
        console.log('Model:', process.env.CHAT_API_OLLAMA_MODEL_TEXT);

        const response = await fetch(`${process.env.CHAT_API_OLLAMA_URL}/generate`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                model: process.env.CHAT_API_OLLAMA_MODEL_TEXT,
                prompt: `Analyze the sentiment of this text and respond with only one word (positive/negative/neutral): "${text}"`,
                stream: false
            })
        });

        if (!response.ok) {
            throw new Error(`Error HTTP: ${response.status} ${response.statusText}`);
        }

        const data = await response.json();

        // Verificar si tenim una resposta vàlida
        if (!data || !data.response) {
            throw new Error('La resposta d\'Ollama no té el format esperat');
        }

        return data.response.trim().toLowerCase();
    } catch (error) {
        console.error('Error detallat en la petició a Ollama:', error);
        return SENTIMENT_ERROR;
    }
}

// Funció per processar les ressenyes d'un joc i calcular les estadístiques
async function processGameReviews(game, reviews, maxReviews = 2) {
    let positive = 0;
    let negative = 0;
    let neutral = 0;
    let error = 0;

    const gameReviews = reviews.filter((review) => review.app_id === game.appid).slice(0, maxReviews);

    for (const review of gameReviews) {
        const sentiment = await analyzeSentiment(review.content);

        switch (sentiment) {
            case SENTIMENT_POSITIVE:
                positive++;
                break;
            case SENTIMENT_NEGATIVE:
                negative++;
                break;
            case SENTIMENT_NEUTRAL:
                neutral++;
                break;
            default:
                error++;
                break;
        }
    }

    return {
        positive,
        negative,
        neutral,
        error,
    };
}



async function main() {
    try {
        // Validem les variables d'entorn necessàries
        if (!process.env.DATA_PATH) {
            throw new Error('La variable d\'entorn DATA_PATH no està definida');
        }
        if (!process.env.CHAT_API_OLLAMA_URL) {
            throw new Error('La variable d\'entorn CHAT_API_OLLAMA_URL no està definida');
        }
        if (!process.env.CHAT_API_OLLAMA_MODEL_TEXT) {
            throw new Error('La variable d\'entorn CHAT_API_OLLAMA_MODEL_TEXT no està definida');
        }

        // Construïm les rutes completes als fitxers CSV
        const gamesFilePath = path.join(__dirname, process.env.DATA_PATH, DATA_SUBFOLDER, CSV_GAMES_FILE_NAME);
        const reviewsFilePath = path.join(__dirname, process.env.DATA_PATH, DATA_SUBFOLDER, CSV_REVIEWS_FILE_NAME);

        // Validem si els fitxers existeixen
        if (!fs.existsSync(gamesFilePath)) {
            throw new Error(`El fitxer de jocs CSV no existeix: ${gamesFilePath}`);
        }
        if (!fs.existsSync(reviewsFilePath)) {
             throw new Error(`El fitxer de reviews CSV no existeix: ${reviewsFilePath}`);
        }

        // Llegim els CSVs
        const games = await readCSV(gamesFilePath);
        const reviews = await readCSV(reviewsFilePath);

        const gameStats = [];

        // Iterem pels jocs
        for (const game of games.slice(0, 2)) {
             // Validar que game.appid existeix i és un string o un número
            if (!game.appid) {
                console.warn(`El joc amb índex ${games.indexOf(game)} no té un appid definit.`);
                continue; // Saltar a la següent iteració del bucle
            }

            const statistics = await processGameReviews(game, reviews);
            gameStats.push({
                appid: game.appid,
                name: game.name,
                statistics,
            });
        }

        const result = {
            timestamp: new Date().toISOString(),
            games: gameStats,
        };

        // Guardem la sortida en un fitxer JSON
        const outputFilePath = path.join(__dirname, process.env.DATA_PATH, 'exercici2_resposta.json');
        fs.writeFileSync(outputFilePath, JSON.stringify(result, null, 2));

        console.log('Sortida guardada a exercici2_resposta.json');
     } catch (error) {
        console.error('Error durant l\'execució:', error.message);
    }
}

// Executem la funció principal
main();