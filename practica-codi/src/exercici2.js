// Importacions
const csv = require('csv-parser');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: '../.env' });

// Constants
const DATA_SUBFOLDER = 'steamreviews';
const CSV_GAMES_FILE_NAME = 'games.csv';
const CSV_REVIEWS_FILE_NAME = 'reviews.csv';

// Funció per llegir el CSV de forma asíncrona
async function readCSV(filePath) {
    const results = [];
    return new Promise((resolve, reject) => {
        fs.createReadStream(filePath)
            .pipe(csv())
            .on('data', (data) => results.push(data))
            .on('end', () => resolve(results))
            .on('error', reject);
    });
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
        return 'error';
    }
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

        console.log(gamesFilePath);

        // Validem si els fitxers existeixen
        if (!fs.existsSync(gamesFilePath) || !fs.existsSync(reviewsFilePath)) {
            throw new Error('Algun dels fitxers CSV no existeix');
        }

        // Llegim els CSVs
        const games = await readCSV(gamesFilePath);
        const reviews = await readCSV(reviewsFilePath);

        const gameStats = [];

        // Iterem pels jocs i les primeres dues ressenyes
        for (const game of games.slice(0, 2)) {
            const gameReviews = reviews.filter((review) => review.app_id === game.appid).slice(0, 2);

            let positive = 0;
            let negative = 0;
            let neutral = 0;
            let error = 0;

            for (const review of gameReviews) {
                const sentiment = await analyzeSentiment(review.content);

                switch (sentiment) {
                    case 'positive':
                        positive++;
                        break;
                    case 'negative':
                        negative++;
                        break;
                    case 'neutral':
                        neutral++;
                        break;
                    default:
                        error++;
                        break;
                }
            }

            gameStats.push({
                appid: game.appid,
                name: game.name,
                statistics: {
                    positive,
                    negative,
                    neutral,
                    error,
                }
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
