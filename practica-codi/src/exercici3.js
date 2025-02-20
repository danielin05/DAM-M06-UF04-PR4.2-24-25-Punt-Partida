// Importacions
const fs = require('fs').promises;
const path = require('path');
require('dotenv').config({ path: '../.env' });

// Constants des de variables d'entorn
const IMAGES_SUBFOLDER = 'imatges/animals';
const IMAGE_TYPES = ['.jpg', '.jpeg', '.png', '.gif'];
const OLLAMA_URL = process.env.CHAT_API_OLLAMA_URL;
const OLLAMA_MODEL = process.env.CHAT_API_OLLAMA_MODEL_VISION;

// Funció per llegir un fitxer i convertir-lo a Base64
async function imageToBase64(imagePath) {
    try {
        const data = await fs.readFile(imagePath);
        return Buffer.from(data).toString('base64');
    } catch (error) {
        console.error(`Error al llegir o convertir la imatge ${imagePath}:`, error.message);
        return null;
    }
}

// Funció per fer la petició a Ollama
async function queryOllama(base64Image, prompt) {
    const requestBody = {
        model: OLLAMA_MODEL,
        prompt: prompt,
        images: [base64Image],
        stream: false
    };

    try {
        console.log('Enviant petició a Ollama...');
        const response = await fetch(`${OLLAMA_URL}/generate`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(requestBody)
        });

        if (!response.ok) {
            throw new Error(`Error HTTP: ${response.status} ${response.statusText}`);
        }

        const data = await response.json();
        if (!data || !data.response) {
            throw new Error('La resposta d\'Ollama no té el format esperat');
        }

        return data.response;
    } catch (error) {
        console.error('Error detallat en la petició a Ollama:', error);
        return null;
    }
}

function limpiarJson(texto) {
    return texto.replace(/^```json\s*/, "").replace(/\s*```$/, "");
}

// Funció principal
async function main() {
    try {
        if (!process.env.DATA_PATH) {
            throw new Error('La variable d\'entorn DATA_PATH no està definida.');
        }
        if (!OLLAMA_URL) {
            throw new Error('La variable d\'entorn CHAT_API_OLLAMA_URL no està definida.');
        }
        if (!OLLAMA_MODEL) {
            throw new Error('La variable d\'entorn CHAT_API_OLLAMA_MODEL no està definida.');
        }

        const imagesFolderPath = path.join(__dirname, process.env.DATA_PATH, IMAGES_SUBFOLDER);
        await fs.access(imagesFolderPath);

        const animalDirectories = await fs.readdir(imagesFolderPath);

        for (const animalDir of animalDirectories) {
            const animalDirPath = path.join(imagesFolderPath, animalDir);
            const stats = await fs.stat(animalDirPath);
            if (!stats.isDirectory()) continue;

            const imageFiles = await fs.readdir(animalDirPath);
            for (const imageFile of imageFiles) {
                const imagePath = path.join(animalDirPath, imageFile);
                const ext = path.extname(imagePath).toLowerCase();
                if (!IMAGE_TYPES.includes(ext)) continue;

                const base64String = await imageToBase64(imagePath);
                if (base64String) {
                    const prompt = `Identify the type of animal in the image and return the result **only** as a JSON object. Do not include any additional text, explanations, or formatting such as Markdown code blocks. The response must be strictly a valid JSON object, without any extra characters before or after.
                    Return only the JSON object in the following structure:
                    {
                        "nom_comu": "Nom comú de l'animal",
                        "nom_cientific": "Nom científic si és conegut",
                        "taxonomia": {
                            "classe": "Mamífer/Au/Rèptil/Amfibi/Peix",
                            "ordre": "Ordre taxonòmic",
                            "familia": "Família taxonòmica"
                        },
                        "habitat": {
                            "tipus": ["Tipus d'hàbitats"],
                            "regioGeografica": ["Regions on viu"],
                            "clima": ["Tipus de climes"]
                        },
                        "dieta": {
                            "tipus": "Carnívor/Herbívor/Omnívor",
                            "aliments_principals": ["Llista d'aliments"]
                        },
                        "caracteristiques_fisiques": {
                            "mida": {
                                "altura_mitjana_cm": "Altura mitjana en cm",
                                "pes_mitja_kg": "Pes mitjà en kg"
                            },
                            "colors_predominants": ["Colors"],
                            "trets_distintius": ["Característiques especials"]
                        },
                        "estat_conservacio": {
                            "classificacio_IUCN": "Estat de conservació segons IUCN",
                            "amenaces_principals": ["Amenaces principals"]
                        }
                    }

                    Strict rules:
                    - **Do not** include any explanations, extra text, or Markdown formatting.
                    - The response must begin with "{" and end with "}".
                    - **No** code block delimiters (\`\`\`json or similar) are allowed.
                    - Ensure the response is a valid JSON object.
                    `;
                    const response = limpiarJson(await queryOllama(base64String, prompt));

                    if (response) {
                        const animalData = {
                            imatge: { nom_fitxer: imageFile },
                            analisi: JSON.parse(response)
                        };
                        
                        const outputFilePath = path.join(__dirname, process.env.DATA_PATH, 'exercici3_resposta.json');
                        await fs.writeFile(outputFilePath, JSON.stringify({ analisis: [animalData] }, null, 2));
                        
                        console.log('Sortida guardada a exercici3_resposta.json');
                        return; // Surt després de processar una sola imatge
                    }
                }
            }
        }
    } catch (error) {
        console.error('Error durant l\'execució:', error.message);
    }
}

// Executem la funció principal
main();
