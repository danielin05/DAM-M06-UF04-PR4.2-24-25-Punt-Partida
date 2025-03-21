const { analyzeSentiment } = require('./exercici2'); // Canvia './script' pel nom del teu fitxer principal

// Mock de la funció fetch
global.fetch = jest.fn();

describe('analyzeSentiment', () => {
    beforeEach(() => {
        fetch.mockClear(); // Neteja el mock abans de cada test
        process.env.CHAT_API_OLLAMA_URL = 'http://localhost:11434';  //Valors per defecte
        process.env.CHAT_API_OLLAMA_MODEL_TEXT = 'mistral'; //Valors per defecte
    });

    it('hauria de retornar "positive" per a un text positiu', async () => {
        fetch.mockResolvedValueOnce({
            ok: true,
            json: async () => ({ response: 'positive' }),
        });

        const sentiment = await analyzeSentiment('Aquest joc és increïble!');
        expect(sentiment).toBe('positive');
        expect(fetch).toHaveBeenCalledTimes(1);
    });

    it('hauria de retornar "negative" per a un text negatiu', async () => {
        fetch.mockResolvedValueOnce({
            ok: true,
            json: async () => ({ response: 'negative' }),
        });

        const sentiment = await analyzeSentiment('Aquest joc és terrible.');
        expect(sentiment).toBe('negative');
        expect(fetch).toHaveBeenCalledTimes(1);

    });

    it('hauria de retornar "neutral" per a un text neutral', async () => {
        fetch.mockResolvedValueOnce({
            ok: true,
            json: async () => ({ response: 'neutral' }),
        });
        const sentiment = await analyzeSentiment('El joc està bé.');
        expect(sentiment).toBe('neutral');
        expect(fetch).toHaveBeenCalledTimes(1);
    });

    it('hauria de retornar "error" si la resposta de l\'API no és vàlida', async () => {
        fetch.mockResolvedValueOnce({
            ok: true,
            json: async () => ({}), // Resposta sense 'response'
        });

        const sentiment = await analyzeSentiment('Text de prova');
        expect(sentiment).toBe('error');
        expect(fetch).toHaveBeenCalledTimes(1);

    });

    it('hauria de retornar "error" si hi ha un error de xarxa', async () => {
        fetch.mockRejectedValueOnce(new Error('Error de xarxa'));

        const sentiment = await analyzeSentiment('Text de prova');
        expect(sentiment).toBe('error');
        expect(fetch).toHaveBeenCalledTimes(1);

    });

    it('hauria de retornar "error" si la resposta de l\'API té un status error', async () => {
        fetch.mockResolvedValueOnce({
            ok: false,
            status: 500,
            statusText: 'Internal Server Error',
        });
        const sentiment = await analyzeSentiment('Text de prova');
        expect(sentiment).toBe('error');
        expect(fetch).toHaveBeenCalledTimes(1);

    });

      it('hauria de fer la petició amb les capçaleres i el cos correctes', async () => {
        fetch.mockResolvedValueOnce({
            ok: true,
            json: async () => ({ response: 'neutral' }),
        });

        const text = 'Text de prova';
        await analyzeSentiment(text);

        expect(fetch).toHaveBeenCalledWith(`${process.env.CHAT_API_OLLAMA_URL}/generate`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                model: process.env.CHAT_API_OLLAMA_MODEL_TEXT,
                prompt: `Analyze the sentiment of this text and respond with only one word (positive/negative/neutral): "${text}"`,
                stream: false,
            }),
        });
    });
});